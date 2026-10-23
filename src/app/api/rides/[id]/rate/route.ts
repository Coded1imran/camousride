import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole, ok, fail, zodMessage } from '@/lib/api';

const RateSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole('STUDENT');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body.', 400);
  }

  const parsed = RateSchema.safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  const ride = await prisma.ride.findUnique({ where: { id: params.id } });
  if (!ride) return fail('Ride not found.', 404);
  if (ride.riderId !== auth.user.id) return fail('Only the rider can rate this ride.', 403);
  if (ride.status !== 'COMPLETED') return fail('You can only rate completed rides.', 409);
  if (!ride.driverId) return fail('This ride had no driver to rate.', 409);

  const existing = await prisma.driverRating.findFirst({
    where: { rideId: ride.id, fromUserId: auth.user.id },
  });
  if (existing) return fail('You already rated this ride.', 409);

  const rating = await prisma.driverRating.create({
    data: {
      rideId: ride.id,
      fromUserId: auth.user.id,
      toUserId: ride.driverId,
      score: parsed.data.score,
      comment: parsed.data.comment,
    },
  });

  return ok({ rating }, 201);
}
