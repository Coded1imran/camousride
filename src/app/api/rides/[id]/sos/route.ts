import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, ok, fail, zodMessage } from '@/lib/api';

const SOSSchema = z.object({
  rideId: z.string().optional(),
  type: z.enum(['SOS', 'FRAUD', 'VEHICLE', 'OTHER']).default('SOS'),
  description: z.string().max(1000).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
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

  const parsed = SOSSchema.safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  const { rideId, type, description, lat, lng } = parsed.data;

  let ride = null;
  if (rideId) {
    ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: { driver: { select: { id: true, name: true, phone: true } } },
    });
    if (!ride) return fail('Ride not found.', 404);
    if (ride.riderId !== auth.user.id && ride.driverId !== auth.user.id) {
      return fail('You can only raise SOS for a ride you are part of.', 403);
    }
  }

  const hour = new Date().getHours();
  const lateNight = hour >= 21 || hour < 5;
  const severity = type === 'SOS' ? (lateNight ? 'high' : 'medium') : type === 'FRAUD' ? 'medium' : 'low';

  const summary = {
    generatedBy: 'rules',
    severity,
    type,
    lateNight,
    reportedBy: { id: auth.user.id, name: auth.user.name, role: auth.user.role },
    ride: ride
      ? {
          id: ride.id,
          pickup: ride.pickup,
          destination: ride.destination,
          status: ride.status,
          driver: ride.driver ? { name: ride.driver.name, phone: ride.driver.phone } : null,
        }
      : null,
    location: lat != null && lng != null ? { lat, lng } : null,
    recommendedAction: lateNight
      ? 'Call the rider immediately and dispatch campus security to the live location.'
      : 'Review the report and contact the rider to confirm safety.',
  };

  const incident = await prisma.sOSIncident.create({
    data: {
      rideId: ride?.id ?? null,
      userId: auth.user.id,
      type,
      lat: lat ?? null,
      lng: lng ?? null,
      description: description ?? null,
      summary: summary as never,
      status: 'OPEN',
    },
  });

  return ok({ incident, summary }, 201);
}
