import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole, ok, fail, zodMessage } from '@/lib/api';
import { askCampusOps, GEMINI_MODEL } from '@/lib/gemma';

const OpsSchema = z.object({ question: z.string().min(3).max(500) });

export async function POST(req: NextRequest) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body.', 400);
  }

  const parsed = OpsSchema.safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  const { answer, meta } = await askCampusOps({ question: parsed.data.question });

  return ok({
    answer,
    ai: {
      model: GEMINI_MODEL,
      fallback: meta.fallback,
      latencyMs: meta.latencyMs,
      tokensIn: meta.usage?.prompt_tokens ?? null,
      tokensOut: meta.usage?.completion_tokens ?? null,
    },
  });
}
