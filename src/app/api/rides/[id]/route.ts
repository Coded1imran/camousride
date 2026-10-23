import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, fail } from '@/lib/api';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;
  const user = auth.user;

  const ride = await prisma.ride.findUnique({
    where: { id: params.id },
    include: {
      rider: { select: { id: true, name: true, phone: true, hostel: true, department: true } },
      driver: { select: { id: true, name: true, phone: true } },
      ratings: { select: { id: true, score: true, comment: true, fromUserId: true } },
      sosIncidents: { select: { id: true, status: true, createdAt: true, type: true } },
    },
  });

  if (!ride) return fail('Ride not found.', 404);

  const isParticipant = ride.riderId === user.id || ride.driverId === user.id;
  const isDriverPreviewing = user.role === 'DRIVER' && ride.status === 'REQUESTED';
  if (!isParticipant && !isDriverPreviewing && user.role !== 'ADMIN') {
    return fail('You do not have access to this ride.', 403);
  }

  return ok({ ride });
}
