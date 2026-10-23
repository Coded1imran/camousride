import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole, requireUser, ok, fail, zodMessage } from '@/lib/api';
import { computeFare, estimateDistanceKm, estimateDurationMin } from '@/lib/fare';
import { createRideFromText } from '@/lib/gemma';
import { resolveZone } from '@/lib/rides';

const CreateRideSchema = z
  .object({
    text: z.string().min(3).max(1000).optional(),
    pickup: z.string().min(2).max(120).optional(),
    destination: z.string().min(2).max(120).optional(),
    scheduledAt: z.string().max(40).optional(),
    passengers: z.number().int().min(1).max(8).optional(),
    wheelchair: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.text) || Boolean(v.pickup && v.destination), {
    message: 'Provide free-text or both pickup and destination.',
  });

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;
  const user = auth.user;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);

  const where =
    user.role === 'STUDENT'
      ? { riderId: user.id }
      : user.role === 'DRIVER'
        ? { OR: [{ driverId: user.id }, { status: 'REQUESTED' as const }] }
        : {};

  const rides = await prisma.ride.findMany({
    where: {
      ...where,
      ...(status ? { status: status as never } : {}),
    },
    include: {
      rider: { select: { id: true, name: true, phone: true, hostel: true } },
      driver: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return ok({ rides });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole('STUDENT');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body.', 400);
  }

  const parsed = CreateRideSchema.safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  let pickup = parsed.data.pickup?.trim();
  let destination = parsed.data.destination?.trim();
  let passengers = parsed.data.passengers ?? 1;
  let scheduledAt = parseDate(parsed.data.scheduledAt);
  let ai: { used: boolean; fallback: boolean; latencyMs: number; tokensIn?: number; tokensOut?: number } | null = null;

  if (parsed.data.text) {
    const result = await createRideFromText({ text: parsed.data.text });
    pickup = pickup || result.draft?.pickup;
    destination = destination || result.draft?.destination;
    passengers = parsed.data.passengers ?? result.draft?.passengers ?? 1;
    if (!scheduledAt && result.draft?.time) scheduledAt = parseDate(result.draft.time);

    ai = {
      used: true,
      fallback: result.meta.fallback,
      latencyMs: result.meta.latencyMs,
      tokensIn: result.meta.usage?.prompt_tokens,
      tokensOut: result.meta.usage?.completion_tokens,
    };
  }

  if (!pickup || !destination) {
    return fail('Could not understand the pickup and destination. Please add them explicitly.', 422);
  }

  const pickupLoc = await prisma.campusLocation.findFirst({ where: { name: { contains: pickup } } });
  const destLoc = await prisma.campusLocation.findFirst({ where: { name: { contains: destination } } });

  const distanceKm =
    pickupLoc && destLoc ? estimateDistanceKm(pickupLoc, destLoc) : 3;
  const durationMin = estimateDurationMin(distanceKm);
  const fare = computeFare({ distanceKm, durationMin, passengers });

  const ride = await prisma.ride.create({
    data: {
      riderId: auth.user.id,
      pickup,
      destination,
      pickupLat: pickupLoc?.lat ?? null,
      pickupLng: pickupLoc?.lng ?? null,
      destLat: destLoc?.lat ?? null,
      destLng: destLoc?.lng ?? null,
      passengers,
      scheduledAt,
      fare: fare as never,
      status: 'REQUESTED',
      statusHistory: { REQUESTED: new Date().toISOString() },
    },
    include: {
      rider: { select: { id: true, name: true, phone: true, hostel: true } },
    },
  });

  const zone = await resolveZone(destination);
  await prisma.demandEvent.create({
    data: { zone, hour: new Date().getHours(), rideId: ride.id },
  });

  return ok({ ride, fare, ai }, 201);
}
