import { prisma } from '@/lib/prisma';
import { requireRole, ok } from '@/lib/api';

export async function GET() {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return auth.error;

  const incidents = await prisma.sOSIncident.findMany({
    include: {
      user: { select: { id: true, name: true, role: true, phone: true } },
      ride: { select: { id: true, pickup: true, destination: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return ok({
    incidents,
    openCount: incidents.filter((i) => i.status === 'OPEN').length,
  });
}
