import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, ok, fail, zodMessage } from '@/lib/api';
import { VehicleSchema } from '@/lib/validation/schemas';

export async function GET() {
  const auth = await requireRole('DRIVER');
  if ('error' in auth) return auth.error;

  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId: auth.user.id },
    orderBy: { createdAt: 'desc' },
  });
  return ok({ vehicles });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole('DRIVER');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body.', 400);
  }

  const parsed = VehicleSchema.safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  const plate = parsed.data.plate.toUpperCase().replace(/\s+/g, '-');
  const existing = await prisma.vehicle.findUnique({ where: { plate } });
  if (existing) return fail('That plate is already registered.', 409);

  const vehicle = await prisma.vehicle.create({
    data: {
      ownerId: auth.user.id,
      make: parsed.data.make,
      model: parsed.data.model,
      plate,
      capacity: parsed.data.capacity,
      photoUrl: parsed.data.photoUrl || null,
    },
  });

  return ok({ vehicle }, 201);
}
