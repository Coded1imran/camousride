import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, ok, fail } from '@/lib/api';
import { canTransition } from '@/lib/rides';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole('DRIVER');
  if ('error' in auth) return auth.error;

  const ride = await prisma.ride.findUnique({ where: { id: params.id } });
  if (!ride) return fail('Ride not found.', 404);
  if (ride.status !== 'REQUESTED') return fail('This ride is no longer open for matching.', 409);
  if (!canTransition('REQUESTED', 'MATCHED')) return fail('Invalid status transition.', 409);

  const vehicles = await prisma.vehicle.findMany({ where: { ownerId: auth.user.id } });
  if (vehicles.length === 0) {
    return fail('Add a vehicle before accepting rides.', 409);
  }
  const capacity = Math.max(...vehicles.map((v) => v.capacity));
  if (capacity < ride.passengers) {
    return fail(`Your vehicles seat up to ${capacity}; this ride needs ${ride.passengers}.`, 409);
  }

  const history = (ride.statusHistory as Record<string, string>) ?? {};
  const updated = await prisma.ride.update({
    where: { id: ride.id },
    data: {
      driverId: auth.user.id,
      status: 'MATCHED',
      statusHistory: { ...history, MATCHED: new Date().toISOString() },
    },
    include: {
      rider: { select: { id: true, name: true, phone: true } },
      driver: { select: { id: true, name: true, phone: true } },
    },
  });

  return ok({ ride: updated });
}
