import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole, ok, fail, zodMessage } from '@/lib/api';

const AssignSchema = z.object({ driverId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole('STUDENT');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body.', 400);
  }

  const parsed = AssignSchema.safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  const ride = await prisma.ride.findUnique({ where: { id: params.id } });
  if (!ride) return fail('Ride not found.', 404);
  if (ride.riderId !== auth.user.id) return fail('Only the rider can choose a driver for this ride.', 403);
  if (ride.status !== 'REQUESTED') return fail('This ride is no longer open.', 409);

  const driver = await prisma.user.findFirst({
    where: { id: parsed.data.driverId, role: 'DRIVER' },
    include: { vehicles: true },
  });
  if (!driver) return fail('Driver not found.', 404);
  const capacity = driver.vehicles.reduce((max, v) => Math.max(max, v.capacity), 0);
  if (capacity < ride.passengers) return fail('That driver does not have enough capacity.', 409);

  const history = (ride.statusHistory as Record<string, string>) ?? {};
  const updated = await prisma.ride.update({
    where: { id: ride.id },
    data: {
      driverId: driver.id,
      status: 'MATCHED',
      statusHistory: { ...history, MATCHED: new Date().toISOString() },
    },
    include: {
      driver: { select: { id: true, name: true, phone: true } },
      rider: { select: { id: true, name: true, phone: true } },
    },
  });

  return ok({ ride: updated, driver: { id: driver.id, name: driver.name } });
}
