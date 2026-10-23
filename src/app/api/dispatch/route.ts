import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole, ok, fail, zodMessage } from '@/lib/api';
import type { DriverCandidate } from '@/lib/gemma';
import { estimateDistanceKm } from '@/lib/fare';

const DispatchSchema = z.object({
  pickup: z.string().min(2).max(120),
  destination: z.string().min(2).max(120),
  passengers: z.number().int().min(1).max(8).default(1),
});

export async function POST(req: NextRequest) {
  const auth = await requireRole('STUDENT', 'DRIVER', 'ADMIN');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body.', 400);
  }

  const parsed = DispatchSchema.safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  const { pickup, destination, passengers } = parsed.data;

  const pickupLoc = await prisma.campusLocation.findFirst({ where: { name: { contains: pickup } } });

  const drivers = await prisma.user.findMany({
    where: {
      role: 'DRIVER',
      vehicles: { some: { capacity: { gte: passengers } } },
      ridesAsDriver: { none: { status: { in: ['MATCHED', 'IN_PROGRESS'] } } },
    },
    include: {
      vehicles: true,
      ratingsReceived: { select: { score: true } },
      availability: true,
      ridesAsDriver: { where: { status: 'COMPLETED' }, select: { id: true } },
    },
    take: 10,
  });

  const now = new Date();
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();

  const candidates: Array<DriverCandidate & { phone: string | null; vehicle: string }> = [];
  for (const d of drivers) {
    const maxVehicle = d.vehicles.reduce((a, b) => (b.capacity > a.capacity ? b : a), d.vehicles[0]);
    const rating =
      d.ratingsReceived.length > 0
        ? d.ratingsReceived.reduce((s, r) => s + r.score, 0) / d.ratingsReceived.length
        : 4.5;
    const onShift = d.availability.some(
      (a) => a.dayOfWeek === day && minutes >= a.startTime && minutes <= a.endTime
    );
    if (!onShift) continue;

    const homeLoc = d.hostel
      ? await prisma.campusLocation.findFirst({ where: { name: { contains: d.hostel } } })
      : null;
    const distanceKm = pickupLoc && homeLoc ? estimateDistanceKm(homeLoc, pickupLoc) : 2;

    candidates.push({
      id: d.id,
      name: d.name,
      phone: d.phone,
      rating: Math.round(rating * 10) / 10,
      trips: d.ridesAsDriver.length,
      capacity: maxVehicle?.capacity ?? 0,
      distanceKm: Math.round(distanceKm * 10) / 10,
      availableNow: onShift,
      vehicle: maxVehicle ? `${maxVehicle.make} ${maxVehicle.model} (${maxVehicle.plate})` : 'No vehicle',
    });
  }

  if (candidates.length === 0) {
    return ok({
      candidates: [],
      ai: null,
      message: 'No drivers are available for this ride right now. You can still request the ride and try again later.',
    });
  }

  const ordered = candidates
    .sort((a, b) => a.distanceKm - b.distanceKm || b.rating - a.rating || b.capacity - a.capacity)
    .map((candidate) => ({
      ...candidate,
      reason: `On shift, ${candidate.distanceKm} km away, and has room for ${passengers} passenger${passengers === 1 ? '' : 's'}.`,
    }));

  return ok({
    candidates: ordered,
    ai: null,
    context: { pickup, destination, passengers },
  });
}
