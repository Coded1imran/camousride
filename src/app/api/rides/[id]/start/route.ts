import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, fail } from '@/lib/api';
import { canTransition } from '@/lib/rides';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;

  const ride = await prisma.ride.findUnique({ where: { id: params.id } });
  if (!ride) return fail('Ride not found.', 404);
  if (ride.driverId !== auth.user.id) return fail('Only the assigned driver can start this ride.', 403);
  if (!canTransition(ride.status as never, 'IN_PROGRESS')) return fail('Ride cannot be started from its current status.', 409);

  const history = (ride.statusHistory as Record<string, string>) ?? {};
  const updated = await prisma.ride.update({
    where: { id: ride.id },
    data: {
      status: 'IN_PROGRESS',
      statusHistory: { ...history, IN_PROGRESS: new Date().toISOString() },
    },
  });

  return ok({ ride: updated });
}
