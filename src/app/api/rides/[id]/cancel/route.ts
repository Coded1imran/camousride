import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, fail } from '@/lib/api';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;

  const ride = await prisma.ride.findUnique({ where: { id: params.id } });
  if (!ride) return fail('Ride not found.', 404);

  const isRider = ride.riderId === auth.user.id;
  const isAssignedDriver = ride.driverId === auth.user.id;
  if (!isRider && !isAssignedDriver) return fail('Only the rider or assigned driver can cancel this ride.', 403);
  if (!['REQUESTED', 'MATCHED'].includes(ride.status)) {
    return fail('Only requested or matched rides can be cancelled.', 409);
  }

  const history = (ride.statusHistory as Record<string, string>) ?? {};
  const updated = await prisma.ride.update({
    where: { id: ride.id },
    data: {
      status: 'CANCELLED',
      statusHistory: { ...history, CANCELLED: new Date().toISOString() },
    },
  });

  return ok({ ride: updated });
}
