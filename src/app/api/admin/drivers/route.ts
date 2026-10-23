import { prisma } from '@/lib/prisma';
import { requireRole, ok } from '@/lib/api';

export async function GET() {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return auth.error;

  const drivers = await prisma.user.findMany({
    where: { role: 'DRIVER' },
    include: {
      vehicles: true,
      ratingsReceived: { select: { score: true } },
      availability: true,
      ridesAsDriver: {
        select: { id: true, status: true, fare: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const result = drivers.map((d) => {
    const completed = d.ridesAsDriver.filter((r) => r.status === 'COMPLETED');
    const earnings = completed.reduce(
      (sum, r) => sum + ((r.fare as { total?: number } | null)?.total ?? 0),
      0
    );
    const avgRating =
      d.ratingsReceived.length > 0
        ? d.ratingsReceived.reduce((s, r) => s + r.score, 0) / d.ratingsReceived.length
        : null;

    return {
      id: d.id,
      name: d.name,
      email: d.email,
      phone: d.phone,
      vehicles: d.vehicles,
      availabilityWindows: d.availability.length,
      completedTrips: completed.length,
      earnings,
      avgRating: avgRating != null ? Math.round(avgRating * 10) / 10 : null,
      compliant: d.vehicles.length > 0 && d.availability.length > 0,
    };
  });

  return ok({
    drivers: result,
    compliantCount: result.filter((d) => d.compliant).length,
    totalDrivers: result.length,
  });
}
