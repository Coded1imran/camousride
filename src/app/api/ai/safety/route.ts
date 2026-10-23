import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole, ok, fail, zodMessage } from '@/lib/api';
import { safetyCheck, GEMINI_MODEL } from '@/lib/gemma';

const SafetySchema = z.object({
  rideId: z.string().optional(),
  incidentId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const parsed = SafetySchema.safeParse(body ?? {});
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  const { rideId, incidentId } = parsed.data;

  let incident = null;
  if (incidentId) {
    incident = await prisma.sOSIncident.findUnique({ where: { id: incidentId } });
    if (!incident) return fail('Incident not found.', 404);
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const lateNightRides = await prisma.ride.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: since } },
    select: { id: true, pickup: true, destination: true, passengers: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const cancellations = await prisma.ride.count({
    where: { status: 'CANCELLED', createdAt: { gte: since } },
  });

  const lateNight = lateNightRides.filter((r) => {
    const h = r.createdAt.getHours();
    return h >= 21 || h < 5;
  });

  const { text, meta } = await safetyCheck({
    rideId: rideId ?? incident?.rideId ?? undefined,
    lateNight: lateNight.length > 0,
    cancellations,
  });

  return ok({
    draft: text,
    context: {
      lateNightRides: lateNight.length,
      recentCancellations: cancellations,
      incident: incident
        ? { id: incident.id, type: incident.type, status: incident.status, description: incident.description }
        : null,
    },
    ai: {
      model: GEMINI_MODEL,
      fallback: meta.fallback,
      latencyMs: meta.latencyMs,
      tokensIn: meta.usage?.prompt_tokens ?? null,
      tokensOut: meta.usage?.completion_tokens ?? null,
    },
  });
}
