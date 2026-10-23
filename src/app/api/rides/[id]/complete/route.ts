import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, fail } from '@/lib/api';
import { canTransition } from '@/lib/rides';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;

  const ride = await prisma.ride.findUnique({ where: { id: params.id } });
  if (!ride) return fail('Ride not found.', 404);

  const isRider = ride.riderId === auth.user.id;
  const isAssignedDriver = ride.driverId === auth.user.id;
  if (!isRider && !isAssignedDriver) return fail('Only the rider or assigned driver can complete this ride.', 403);
  if (!canTransition(ride.status as never, 'COMPLETED')) return fail('Ride cannot be completed from its current status.', 409);

  const history = (ride.statusHistory as Record<string, string>) ?? {};
  const updated = await prisma.ride.update({
    where: { id: ride.id },
    data: {
      status: 'COMPLETED',
      statusHistory: { ...history, COMPLETED: new Date().toISOString() },
    },
    include: {
      driver: { select: { id: true, name: true } },
      rider: { select: { id: true, name: true } },
    },
  });

  return ok({ ride: updated });
}
