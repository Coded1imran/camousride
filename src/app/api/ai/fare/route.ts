import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, fail, zodMessage } from '@/lib/api';
import { computeFare, estimateDistanceKm, estimateDurationMin } from '@/lib/fare';
import { explainFare, GEMINI_MODEL } from '@/lib/gemma';

const FareSchema = z.object({
  pickup: z.string().min(2).max(120),
  destination: z.string().min(2).max(120),
  passengers: z.number().int().min(1).max(8).default(1),
  discount: z.number().min(0).max(500).default(0),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body.', 400);
  }

  const parsed = FareSchema.safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  const { pickup, destination, passengers, discount } = parsed.data;
  const pickupLoc = await prisma.campusLocation.findFirst({ where: { name: { contains: pickup } } });
  const destLoc = await prisma.campusLocation.findFirst({ where: { name: { contains: destination } } });

  const distanceKm = pickupLoc && destLoc ? estimateDistanceKm(pickupLoc, destLoc) : 3;
  const durationMin = estimateDurationMin(distanceKm);
  const fare = computeFare({ distanceKm, durationMin, passengers, discount });

  const { text, meta } = await explainFare({
    pickup,
    destination,
    passengers,
    fare: {
      total: fare.total,
      base: fare.base,
      surge: fare.surge,
      discount: fare.discount,
      distanceKm: fare.distanceKm,
      durationMin: fare.durationMin,
      currency: fare.currency,
    },
  });

  return ok({
    fare,
    explanation: text,
    ai: {
      model: GEMINI_MODEL,
      fallback: meta.fallback,
      latencyMs: meta.latencyMs,
      tokensIn: meta.usage?.prompt_tokens ?? null,
      tokensOut: meta.usage?.completion_tokens ?? null,
    },
  });
}
