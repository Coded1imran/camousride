import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole, ok, fail, zodMessage } from '@/lib/api';
import { resolveZone } from '@/lib/rides';

const JoinSchema = z.object({
  pickup: z.string().min(2).max(120).optional(),
  destination: z.string().min(2).max(120).optional(),
  passengers: z.number().int().min(1).max(4).default(1),
  scheduledAt: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole('STUDENT');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const parsed = JoinSchema.safeParse(body ?? {});
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  const target = await prisma.ride.findUnique({ where: { id: params.id } });
  if (!target) return fail('Ride not found.', 404);
  if (target.riderId === auth.user.id) return fail('You cannot join your own ride.', 409);
  if (!['REQUESTED', 'MATCHED'].includes(target.status)) {
    return fail('This ride is no longer accepting carpoolers.', 409);
  }

  const passengers = parsed.data.passengers;
  if (target.passengers + passengers > 4) {
    return fail('That shared ride is full.', 409);
  }

  const existingFare = (target.fare as { total?: number; discount?: number; currency?: string }) ?? {};
  const previousTotal = existingFare.total ?? 0;
  const discount = Math.round(previousTotal * 0.3);
  const newTotal = Math.max(0, previousTotal - discount);
  const poolId = target.poolId ?? `pool-${target.id}`;
  const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : target.scheduledAt;

  await prisma.ride.update({
    where: { id: target.id },
    data: {
      poolId,
      fare: {
        ...existingFare,
        total: newTotal,
        discount: (existingFare.discount ?? 0) + discount,
        pooled: true,
      } as never,
    },
  });

  const ride = await prisma.ride.create({
    data: {
      riderId: auth.user.id,
      driverId: target.driverId,
      status: target.driverId ? 'MATCHED' : 'REQUESTED',
      pickup: parsed.data.pickup ?? target.pickup,
      destination: parsed.data.destination ?? target.destination,
      passengers,
      scheduledAt: scheduledAt instanceof Date && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt : null,
      pickupLat: target.pickupLat,
      pickupLng: target.pickupLng,
      destLat: target.destLat,
      destLng: target.destLng,
      fare: {
        ...existingFare,
        total: newTotal,
        discount,
        pooled: true,
      } as never,
      poolId,
      statusHistory: {
        REQUESTED: new Date().toISOString(),
        ...(target.driverId ? { MATCHED: new Date().toISOString() } : {}),
      },
    },
    include: {
      rider: { select: { id: true, name: true } },
      driver: { select: { id: true, name: true } },
    },
  });

  const zone = await resolveZone(ride.destination);
  await prisma.demandEvent.create({ data: { zone, hour: new Date().getHours(), rideId: ride.id } });

  return ok({ ride, poolId, discount, total: newTotal }, 201);
}
