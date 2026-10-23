import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole, ok, fail, zodMessage } from '@/lib/api';
import { computeFare, estimateDistanceKm, estimateDurationMin } from '@/lib/fare';
import { createRideFromText, GEMINI_MODEL } from '@/lib/gemma';

const BookSchema = z.object({ text: z.string().min(3).max(1000) });

export async function POST(req: NextRequest) {
  const auth = await requireRole('STUDENT');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body.', 400);
  }

  const parsed = BookSchema.safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  const { draft, meta } = await createRideFromText({ text: parsed.data.text });
  if (!draft) return fail('Could not understand that request. Try naming the pickup and destination.', 422);

  const pickupLoc = await prisma.campusLocation.findFirst({ where: { name: { contains: draft.pickup } } });
  const destLoc = await prisma.campusLocation.findFirst({ where: { name: { contains: draft.destination } } });

  const distanceKm = pickupLoc && destLoc ? estimateDistanceKm(pickupLoc, destLoc) : 3;
  const durationMin = estimateDurationMin(distanceKm);
  const fare = computeFare({ distanceKm, durationMin, passengers: draft.passengers });

  return ok({
    draft: { ...draft, scheduledAt: draft.time ?? null },
    fare,
    pickupLocation: pickupLoc,
    destinationLocation: destLoc,
    ai: {
      model: GEMINI_MODEL,
      fallback: meta.fallback,
      latencyMs: meta.latencyMs,
      tokensIn: meta.usage?.prompt_tokens ?? null,
      tokensOut: meta.usage?.completion_tokens ?? null,
    },
  });
}
