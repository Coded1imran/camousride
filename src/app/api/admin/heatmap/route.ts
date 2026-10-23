import { prisma } from '@/lib/prisma';
import { requireRole, ok } from '@/lib/api';

export async function GET() {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return auth.error;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [events, unmet, locations] = await Promise.all([
    prisma.demandEvent.findMany({ where: { createdAt: { gte: since } } }),
    prisma.ride.findMany({
      where: { status: 'REQUESTED', createdAt: { gte: since } },
      select: { id: true, pickup: true, destination: true, passengers: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.campusLocation.findMany({ orderBy: { zone: 'asc' } }),
  ]);

  const zoneMap = new Map<string, { zone: string; total: number; hours: number[] }>();
  for (const e of events) {
    if (!zoneMap.has(e.zone)) {
      zoneMap.set(e.zone, { zone: e.zone, total: 0, hours: Array(24).fill(0) });
    }
    const z = zoneMap.get(e.zone)!;
    z.total += 1;
    z.hours[e.hour] = (z.hours[e.hour] ?? 0) + 1;
  }

  const zones = [...zoneMap.values()].sort((a, b) => b.total - a.total);

  let peakZone = '—';
  let peakHour = 0;
  let peakCount = 0;
  for (const z of zones) {
    z.hours.forEach((count: number, hour: number) => {
      if (count > peakCount) {
        peakCount = count;
        peakHour = hour;
        peakZone = z.zone;
      }
    });
  }

  const maxHour = events.reduce((m, e) => Math.max(m, e.hour), 0);

  return ok({
    zones,
    locations,
    peak: { zone: peakZone, hour: peakHour, count: peakCount },
    totalDemand: events.length,
    unmetCount: unmet.length,
    unmet,
    hourlyTotals: Array.from({ length: 24 }, (_, hour) =>
      events.filter((e) => e.hour === hour).length
    ),
    busiestHour: maxHour,
  });
}
