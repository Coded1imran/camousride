import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole, ok, fail, zodMessage } from '@/lib/api';
import { matchCarpool, GEMINI_MODEL } from '@/lib/gemma';

const CarpoolSchema = z.object({
  pickup: z.string().min(2).max(120),
  destination: z.string().min(2).max(120),
  passengers: z.number().int().min(1).max(8).default(1),
  scheduledAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireRole('STUDENT');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body.', 400);
  }

  const parsed = CarpoolSchema.safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  const { pickup, destination, scheduledAt } = parsed.data;

  const words = destination
    .toLowerCase()
    .replace(/(faculty of|hall|gate|centre|center|building)/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const candidates = await prisma.ride.findMany({
    where: {
      riderId: { not: auth.user.id },
      status: { in: ['REQUESTED', 'MATCHED'] },
      OR: words.length
        ? words.map((w) => ({ destination: { contains: w } }))
        : [{ destination: { contains: destination } }],
    },
    include: { rider: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });

  const result = await matchCarpool({
    destination,
    scheduledAt: scheduledAt ?? null,
    candidates: candidates.map((c) => ({
      id: c.id,
      riderName: c.rider.name,
      pickup: c.pickup,
      destination: c.destination,
      passengers: c.passengers,
      scheduledAt: c.scheduledAt?.toISOString() ?? null,
    })),
  });

  return ok({
    groups: result.groups.map((g) => ({
      ...g,
      rides: candidates
        .filter((c) => g.candidateIds.includes(c.id))
        .map((c) => ({
          id: c.id,
          riderName: c.rider.name,
          pickup: c.pickup,
          destination: c.destination,
          passengers: c.passengers,
          scheduledAt: c.scheduledAt,
        })),
    })),
    context: { pickup, destination, passengers: parsed.data.passengers },
    ai: {
      model: GEMINI_MODEL,
      fallback: result.meta.fallback,
      latencyMs: result.meta.latencyMs,
      tokensIn: result.meta.usage?.prompt_tokens ?? null,
      tokensOut: result.meta.usage?.completion_tokens ?? null,
    },
  });
}
