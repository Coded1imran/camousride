import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, ok, fail, zodMessage } from '@/lib/api';
import { VehicleSchema } from '@/lib/validation/schemas';

async function ownedVehicle(id: string, ownerId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) return { error: fail('Vehicle not found.', 404) } as const;
  if (vehicle.ownerId !== ownerId) return { error: fail('You do not own this vehicle.', 403) } as const;
  return { vehicle } as const;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole('DRIVER');
  if ('error' in auth) return auth.error;

  const found = await ownedVehicle(params.id, auth.user.id);
  if ('error' in found) return found.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body.', 400);
  }

  const parsed = VehicleSchema.partial().safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  const vehicle = await prisma.vehicle.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.make ? { make: parsed.data.make } : {}),
      ...(parsed.data.model ? { model: parsed.data.model } : {}),
      ...(parsed.data.plate ? { plate: parsed.data.plate.toUpperCase().replace(/\s+/g, '-') } : {}),
      ...(parsed.data.capacity ? { capacity: parsed.data.capacity } : {}),
      ...(parsed.data.photoUrl !== undefined ? { photoUrl: parsed.data.photoUrl || null } : {}),
    },
  });

  return ok({ vehicle });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole('DRIVER');
  if ('error' in auth) return auth.error;

  const found = await ownedVehicle(params.id, auth.user.id);
  if ('error' in found) return found.error;

  await prisma.vehicle.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
