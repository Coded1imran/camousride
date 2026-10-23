import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole, ok, fail, zodMessage } from '@/lib/api';
import { AvailabilitySchema } from '@/lib/validation/schemas';

const WindowsSchema = z.object({
  windows: z.array(AvailabilitySchema).max(21),
});

export async function GET() {
  const auth = await requireRole('DRIVER');
  if ('error' in auth) return auth.error;

  const windows = await prisma.driverAvailability.findMany({
    where: { driverId: auth.user.id },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  return ok({ windows });
}

/** Replace the driver's whole weekly availability with the submitted windows. */
export async function PUT(req: NextRequest) {
  const auth = await requireRole('DRIVER');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body.', 400);
  }

  const parsed = WindowsSchema.safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  await prisma.$transaction([
    prisma.driverAvailability.deleteMany({ where: { driverId: auth.user.id } }),
    prisma.driverAvailability.createMany({
      data: parsed.data.windows.map((w) => ({
        driverId: auth.user.id,
        dayOfWeek: w.dayOfWeek,
        startTime: w.startTime,
        endTime: w.endTime,
      })),
    }),
  ]);

  const windows = await prisma.driverAvailability.findMany({
    where: { driverId: auth.user.id },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  return ok({ windows });
}
