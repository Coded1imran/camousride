import { prisma } from './prisma';
import { RideDraftSchema } from './validation/schemas';

/**
 * SINGLE AI MODULE — all Gemma calls flow through here.
 * Model/base URL/key come from env (GEMINI_API_KEY, GEMINI_BASE_URL, GEMINI_MODEL).
 * Every call is logged to the AICallLog table (input, output, latency, tokens, model, fallback).
 */

export const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemma-4-31b-it';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;
const configuredTimeoutMs = Number(process.env.GEMINI_TIMEOUT_MS);
const GEMINI_TIMEOUT_MS =
  Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0 ? configuredTimeoutMs : 60000;

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    let response: Response | undefined;

    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS) });
    } catch (error) {
      const retryableNetworkError =
        error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError');
      if (!retryableNetworkError || attempt >= MAX_RETRIES) throw error;
    }

    if (response) {
      const retryableStatus = response.status === 429 || response.status >= 500;
      if (response.ok || !retryableStatus || attempt >= MAX_RETRIES) return response;
      await response.clone().text().catch(() => '');
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * 2 ** attempt));
  }
}

export interface GeminiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

export interface GeminiTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface GeminiToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface GeminiResult {
  text: string;
  toolCalls: GeminiToolCall[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  latencyMs: number;
  fallback: boolean;
}

export interface CallArgs {
  system: string;
  messages: GeminiMessage[];
  tools?: GeminiTool[];
  toolChoice?: 'auto' | 'none' | 'required';
  maxTokens?: number;
  /** Allowlisted tool execution handlers: tool name -> (args) => result */
  handlers?: Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
  /** Max tool loop iterations before returning to caller */
  maxToolRounds?: number;
}

async function logAICall(entry: {
  tool: string;
  input: unknown;
  output: unknown;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  status: string;
  fallbackUsed: boolean;
}) {
  try {
    await prisma.aICallLog.create({
      data: {
        tool: entry.tool,
        input: entry.input as never,
        output: entry.output as never,
        latencyMs: entry.latencyMs,
        tokensIn: entry.tokensIn ?? null,
        tokensOut: entry.tokensOut ?? null,
        status: entry.status,
        fallbackUsed: entry.fallbackUsed,
      },
    });
  } catch {
    // Logging must never break the AI flow.
  }
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  handlers?: Record<string, (args: Record<string, unknown>) => Promise<unknown>>
): Promise<unknown> {
  const handler = handlers?.[name];
  if (!handler) return { error: 'tool_not_allowed', name };
  try {
    return await handler(args ?? {});
  } catch (e) {
    return { error: 'tool_failed', name, message: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function callGemma(args: CallArgs): Promise<GeminiResult> {
  const started = Date.now();
  const fallbackResult: GeminiResult = {
    text: '',
    toolCalls: [],
    latencyMs: Date.now() - started,
    fallback: true,
  };

  const finish = async (partial: Partial<GeminiResult>) => {
    await logAICall({
      tool: 'chat',
      input: { system: args.system, messages: args.messages },
      output: partial.text,
      latencyMs: Date.now() - started,
      tokensIn: partial.usage?.prompt_tokens,
      tokensOut: partial.usage?.completion_tokens,
      status: partial.fallback ? 'FALLBACK' : 'SUCCESS',
      fallbackUsed: partial.fallback ?? true,
    });
    return { ...fallbackResult, ...partial, fallback: partial.fallback ?? true } as GeminiResult;
  };

  if (!GEMINI_API_KEY) {
    return finish({ text: '', fallback: true });
  }

  try {
    const res = await fetchWithRetry(`${GEMINI_BASE_URL}chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        messages: [{ role: 'system', content: args.system, ...(args.messages[0]?.role === 'system' ? {} : {}) }, ...args.messages],
        ...(args.tools?.length ? { tools: args.tools, tool_choice: args.toolChoice ?? 'auto' } : {}),
        ...(args.maxTokens ? { max_tokens: args.maxTokens } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return finish({ text: `Gemma API error ${res.status}: ${body.slice(0, 200)}`, fallback: true });
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string; tool_calls?: GeminiToolCall[] } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const message = data.choices?.[0]?.message;
    const text = message?.content ?? '';
    const toolCalls = message?.tool_calls ?? [];

    const result: GeminiResult = {
      text,
      toolCalls,
      usage: data.usage,
      latencyMs: Date.now() - started,
      fallback: false,
    };

    if (toolCalls.length > 0 && args.handlers?.length) {
      // Simple tool loop: pass tool results back until text or round limit.
      let current = result;
      let rounds = 0;
      const maxRounds = args.maxToolRounds ?? 3;
      while (current.toolCalls.length > 0 && rounds < maxRounds) {
        const call = current.toolCalls[0];
        rounds += 1;
        const parsed = safeParseJson(call.arguments);
        const toolName = call.name;
        const toolResult = await executeTool(toolName, parsed, args.handlers);
        const history = [
          ...args.messages,
          { role: 'assistant', content: text || JSON.stringify({ tool: toolName, ...parsed }) },
          { role: 'tool', content: JSON.stringify(toolResult), toolCallId: call.id },
        ] as GeminiMessage[];
        current = await callGemma({
          system: args.system,
          messages: history,
          tools: args.tools,
          toolChoice: 'auto',
          maxTokens: args.maxTokens,
          handlers: args.handlers,
          maxToolRounds: maxRounds - rounds,
        });
      }
      return { ...current, fallback: false };
    }

    return result;
  } catch (e) {
    const message =
      e instanceof DOMException && e.name === 'TimeoutError'
        ? `Request timed out after ${GEMINI_TIMEOUT_MS / 1000} seconds.`
        : e instanceof Error
          ? e.message
          : 'unknown';
    return finish({ text: `Gemma call failed: ${message}`, fallback: true });
  }
}

function safeParseJson(s?: string): Record<string, unknown> {
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function chat(args: CallArgs): Promise<GeminiResult> {
  const res = await callGemma(args);
  return res;
}

/* ------------------------------------------------------------------ */
/* Ride drafting via function calling + Zod validation                 */
/* ------------------------------------------------------------------ */

const CREATE_RIDE_TOOL: GeminiTool = {
  type: 'function',
  function: {
    name: 'create_ride',
    description:
      'Create a structured ride request from the rider natural language. Call this whenever the user asks to book/request a ride.',
    parameters: {
      type: 'object',
      properties: {
        pickup: { type: 'string', description: 'Pickup location e.g. Moremi Hall' },
        destination: { type: 'string', description: 'Destination e.g. Faculty of Science' },
        time: { type: 'string', description: 'Requested time as ISO or human readable, optional' },
        passengers: { type: 'integer', description: 'Number of passengers including rider, 1-8' },
        wheelchair: { type: 'boolean', description: 'Whether wheelchair accessible vehicle is needed' },
      },
      required: ['pickup', 'destination'],
    },
  },
};

const ASK_OPS_TOOL: GeminiTool = {
  type: 'function',
  function: {
    name: 'query_campus_demand',
    description:
      'Query the campus demand analytics database for a zone and hour metric. Only this allowlisted tool may be called for analytics.',
    parameters: {
      type: 'object',
      properties: {
        zone: { type: 'string', description: 'Campus zone name' },
        metric: { type: 'string', enum: ['demand', 'unmet_demand', 'avg_fare'] },
      },
      required: ['zone'],
    },
  },
};

export interface RideDraft {
  pickup: string;
  destination: string;
  time?: string;
  passengers: number;
  wheelchair: boolean;
}

/** Heuristic fallback parser used when the Gemma API is unreachable / key missing. */
export function heuristicRideDraft(text: string): RideDraft {
  const t = text.toLowerCase();
  const fromMatch = t.match(/from\s+(.{2,40}?)\s+to\s+(.{2,40})/);
  let pickup = 'Moremi Hall';
  let destination = 'Faculty of Science';
  if (fromMatch) {
    pickup = fromMatch[1].trim();
    destination = fromMatch[2].trim();
  }
  const pax = t.match(/(\d+)\s+(?:friend|friends|passenger|passengers|person|people|mate|mates|student|students)/);
  const passengers = pax ? Math.min(8, Math.max(1, parseInt(pax[1], 10) + 1)) : 1;
  const timeMatch = t.match(/(?:at\s+)?(\d{1,2}(?::\d{2})?\s?(?:am|pm|pm)?)/);
  const time = timeMatch ? timeMatch[1] : undefined;
  const wheelchair = t.includes('wheelchair') || t.includes('accessible') || t.includes('wheel chair');
  return { pickup, destination, time, passengers, wheelchair };
}

export async function createRideFromText(input: {
  text: string;
}): Promise<{ draft?: RideDraft; meta: GeminiResult }> {
  const result = await chat({
    system:
      'You are CampusRide AI. Convert rider natural language into a structured ride request. ' +
      'Use the create_ride tool. Pickup/destination must be short location names. Passengers includes the rider.',
    messages: [{ role: 'user', content: input.text }],
    tools: [CREATE_RIDE_TOOL],
    toolChoice: 'required',
    maxTokens: 1024,
    handlers: {
      create_ride: async (args) => {
        const parsed = RideDraftSchema.parse({
          pickup: String(args.pickup ?? ''),
          destination: String(args.destination ?? ''),
          time: args.time ? String(args.time) : undefined,
          passengers: Number(args.passengers ?? 1),
          wheelchair: Boolean(args.wheelchair ?? false),
        });
        return { ok: true, draft: parsed };
      },
    },
  });

  let draft: RideDraft | undefined;
  if (result.toolCalls.length > 0) {
    const call = result.toolCalls[0];
    const args = safeParseJson(call.arguments);
    const parsed = RideDraftSchema.safeParse({
      pickup: String(args.pickup ?? ''),
      destination: String(args.destination ?? ''),
      time: args.time ? String(args.time) : undefined,
      passengers: Number(args.passengers ?? 1),
      wheelchair: Boolean(args.wheelchair ?? false),
    });
    if (parsed.success) draft = parsed.data;
  }

  if (!draft) {
    draft = heuristicRideDraft(input.text);
  }

  return { draft, meta: result };
}

export async function askCampusOps(input: { question: string }): Promise<{ answer: string; meta: GeminiResult }> {
  const result = await chat({
    system:
      'You are "Campus Ops" AI assistant for a university transport office. Answer admin questions about ' +
      'campus ride demand using the query_campus_demand tool. Explain numbers clearly and recommend actions.',
    messages: [{ role: 'user', content: input.question }],
    tools: [ASK_OPS_TOOL],
    toolChoice: 'required',
    maxTokens: 1500,
    handlers: {
      query_campus_demand: async (args) => {
        const zone = String(args.zone ?? 'Central');
        const metric = String(args.metric ?? 'demand');
        const rides = await prisma.ride.findMany({
          where: { status: 'COMPLETED' },
          select: { destination: true, fare: true, createdAt: true },
          take: 200,
        });
        const inZone = rides.filter(
          (r) =>
            (r.destination ?? '').toLowerCase().includes(zone.toLowerCase()) ||
            (r.destination ?? '').toLowerCase().includes(zone.toLowerCase().split(' ')[0])
        );
        const totalFare = inZone.reduce((sum, r) => sum + ((r.fare as { total?: number })?.total ?? 0), 0);
        return {
          ok: true,
          zone,
          metric,
          ridesInZone: inZone.length,
          totalFareNgn: totalFare,
        };
      },
    },
  });

  return { answer: result.text || 'I could not compute that yet.', meta: result };
}

export async function explainFare(input: {
  pickup: string;
  destination: string;
  passengers?: number;
  fare?: { total: number; base: number; surge: number; discount: number; distanceKm: number; durationMin: number; currency?: string };
}): Promise<{ text: string; meta: GeminiResult }> {
  const fallbackText = input.fare
    ? `Your ride from ${input.pickup} to ${input.destination} costs ${input.fare.currency ?? 'NGN'} ${input.fare.total}. ` +
      `Base fare is ${input.fare.base}, distance ${input.fare.distanceKm} km and about ${input.fare.durationMin} minutes. ` +
      (input.fare.surge > 1 ? `A ${input.fare.surge}x busy-time surge is included. ` : '') +
      (input.fare.discount > 0 ? `A ${input.fare.currency ?? 'NGN'} ${input.fare.discount} carpool discount is applied. ` : '') +
      'Share the ride with another rider heading the same way to split the fare.'
    : `Fares combine a base fare, distance and time. Pooling with another rider lowers your share.`;

  const result = await chat({
    system:
      'You are the CampusRide fare explainer. Explain the fare breakdown clearly and briefly, including any surge or ' +
      'carpool discount, and how the rider could pay less by pooling. Be friendly and specific. Do not invent numbers.',
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          pickup: input.pickup,
          destination: input.destination,
          passengers: input.passengers ?? 1,
          fare: input.fare ?? null,
        }),
      },
    ],
    maxTokens: 500,
  });

  return { text: result.fallback || !result.text ? fallbackText : result.text, meta: result };
}

/* ------------------------------------------------------------------ */
/* Smart dispatch ranking (AI-first, heuristic fallback)               */
/* ------------------------------------------------------------------ */

export interface DriverCandidate {
  id: string;
  name: string;
  rating: number;
  trips: number;
  capacity: number;
  distanceKm: number;
  availableNow: boolean;
  vehicle?: string;
}

const RANK_DRIVERS_TOOL: GeminiTool = {
  type: 'function',
  function: {
    name: 'rank_drivers',
    description:
      'Rank available drivers for a campus ride. Consider distance to pickup, vehicle capacity, rating, trips and shift availability. Return best first with one-line reason for each.',
    parameters: {
      type: 'object',
      properties: {
        ranking: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              driverId: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['driverId', 'reason'],
          },
        },
      },
      required: ['ranking'],
    },
  },
};

function heuristicRanking(drivers: DriverCandidate[], passengers: number) {
  const score = (d: DriverCandidate) =>
    (d.availableNow ? 40 : 0) +
    Math.max(0, 30 - d.distanceKm * 6) +
    d.rating * 6 +
    Math.min(12, d.trips) +
    (d.capacity >= passengers ? 6 : -20);

  return [...drivers]
    .sort((a, b) => score(b) - score(a))
    .map((d) => ({
      driverId: d.id,
      reason:
        `${d.rating.toFixed(1)}★ driver ${d.distanceKm.toFixed(1)} km away` +
        `${d.availableNow ? ', on shift now' : ''}` +
        `${d.capacity >= passengers ? `, seats ${d.capacity}` : ', capacity too small'}.`,
    }));
}

export async function rankDrivers(input: {
  pickup: string;
  destination: string;
  passengers: number;
  drivers: DriverCandidate[];
}): Promise<{ ranking: Array<{ driverId: string; reason: string }>; meta: GeminiResult }> {
  const result = await chat({
    system:
      'You are CampusRide dispatch AI. Rank drivers for this ride using distance, capacity, rating and shift hours. ' +
      'Only use the drivers provided. Return a ranking via the rank_drivers tool, best first, with a one-line reason each.',
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          pickup: input.pickup,
          destination: input.destination,
          passengers: input.passengers,
          drivers: input.drivers,
        }),
      },
    ],
    tools: [RANK_DRIVERS_TOOL],
    toolChoice: 'required',
    maxTokens: 900,
    handlers: {
      rank_drivers: async () => ({ ok: true }),
    },
  });

  let ranking: Array<{ driverId: string; reason: string }> = [];
  if (result.toolCalls.length > 0) {
    const args = safeParseJson(result.toolCalls[0].arguments);
    const raw = args.ranking;
    if (Array.isArray(raw)) {
      ranking = raw
        .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
        .map((r) => ({ driverId: String(r.driverId ?? ''), reason: String(r.reason ?? '') }))
        .filter((r) => r.driverId && input.drivers.some((d) => d.id === r.driverId));
    }
  }

  if (ranking.length === 0) ranking = heuristicRanking(input.drivers, input.passengers);

  return { ranking, meta: result };
}

/* ------------------------------------------------------------------ */
/* Smart carpool matching (AI-first, heuristic fallback)               */
/* ------------------------------------------------------------------ */

export interface CarpoolCandidate {
  id: string;
  riderName: string;
  pickup: string;
  destination: string;
  passengers: number;
  scheduledAt?: string | null;
}

const CARPOOL_TOOL: GeminiTool = {
  type: 'function',
  function: {
    name: 'propose_carpool',
    description:
      'Group riders travelling the same direction at similar times into shared rides. Return groups with the rider ids, a one-line explanation of why they match, and a suggested discount percent.',
    parameters: {
      type: 'object',
      properties: {
        groups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              candidateIds: { type: 'array', items: { type: 'string' } },
              explanation: { type: 'string' },
              discountPercent: { type: 'number' },
            },
            required: ['candidateIds', 'explanation', 'discountPercent'],
          },
        },
      },
      required: ['groups'],
    },
  },
};

function heuristicCarpool(input: { destination: string; scheduledAt?: string | null; candidates: CarpoolCandidate[] }) {
  const targetTime = input.scheduledAt ? new Date(input.scheduledAt).getTime() : Date.now();
  const dest = input.destination.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

  return input.candidates
    .filter((c) => {
      const candidateDest = c.destination.toLowerCase();
      const sameDirection = dest.some((w) => candidateDest.includes(w));
      const time = c.scheduledAt ? new Date(c.scheduledAt).getTime() : Date.now();
      const closeInTime = Math.abs(time - targetTime) <= 60 * 60 * 1000;
      return sameDirection && closeInTime;
    })
    .slice(0, 3)
    .map((c) => ({
      candidateIds: [c.id],
      explanation: `${c.riderName} is also heading to ${c.destination} within an hour — share the trip and split the fare.`,
      discountPercent: 30,
    }));
}

export async function matchCarpool(input: {
  destination: string;
  scheduledAt?: string | null;
  candidates: CarpoolCandidate[];
}): Promise<{ groups: Array<{ candidateIds: string[]; explanation: string; discountPercent: number }>; meta: GeminiResult }> {
  if (input.candidates.length === 0) {
    return {
      groups: [],
      meta: { text: '', toolCalls: [], latencyMs: 0, fallback: true },
    };
  }

  const result = await chat({
    system:
      'You are CampusRide carpool AI. Group riders going the same direction at similar times. Be conservative: only group riders ' +
      'whose destination overlaps and whose times are within about an hour. Explain each match in one friendly line. ' +
      'Use the propose_carpool tool.',
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          targetDestination: input.destination,
          targetTime: input.scheduledAt ?? null,
          candidates: input.candidates,
        }),
      },
    ],
    tools: [CARPOOL_TOOL],
    toolChoice: 'required',
    maxTokens: 900,
    handlers: { propose_carpool: async () => ({ ok: true }) },
  });

  let groups: Array<{ candidateIds: string[]; explanation: string; discountPercent: number }> = [];
  if (result.toolCalls.length > 0) {
    const args = safeParseJson(result.toolCalls[0].arguments);
    if (Array.isArray(args.groups)) {
      groups = args.groups
        .filter((g): g is Record<string, unknown> => typeof g === 'object' && g !== null)
        .map((g) => ({
          candidateIds: Array.isArray(g.candidateIds) ? g.candidateIds.map(String) : [],
          explanation: String(g.explanation ?? ''),
          discountPercent: Math.min(50, Math.max(0, Number(g.discountPercent ?? 25))),
        }))
        .filter((g) => g.candidateIds.length > 0);
    }
  }

  if (groups.length === 0) {
    groups = heuristicCarpool(input);
    result.fallback = true;
  }

  return { groups, meta: result };
}

export async function safetyCheck(input: { rideId?: string; lateNight: boolean; routeDeviations?: number; cancellations?: number }): Promise<{ text: string; meta: GeminiResult }> {
  const result = await chat({
    system: 'You are the CampusRide Safety Copilot. For late-night rides flag unusual patterns (route deviation, long stops, repeated cancellations) and draft an admin alert.',
    messages: [{ role: 'user', content: JSON.stringify({ rideId: input.rideId, lateNight: input.lateNight, routeDeviations: input.routeDeviations ?? 0, cancellations: input.cancellations ?? 0 }) }],
    maxTokens: 900,
  });
  return { text: result.text, meta: result };
}

export async function dispatchRanking(input: { pickup: string; destination: string; passengers: number }): Promise<{ text: string; meta: GeminiResult }> {
  const result = await chat({
    system: 'You are CampusRide dispatch AI. Rank available drivers by distance, capacity, rating and shift hours; give a one-line reason.',
    messages: [{ role: 'user', content: JSON.stringify({ pickup: input.pickup, destination: input.destination, passengers: input.passengers }) }],
    maxTokens: 900,
  });
  return { text: result.text, meta: result };
}
