import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, ok } from '@/lib/api';

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 30), 1), 100);

  const logs = await prisma.aICallLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const totals = await prisma.aICallLog.aggregate({
    _count: { _all: true },
    _avg: { latencyMs: true },
    _sum: { tokensIn: true, tokensOut: true },
  });

  const fallbackCount = await prisma.aICallLog.count({ where: { fallbackUsed: true } });

  return ok({
    logs,
    stats: {
      totalCalls: totals._count._all,
      avgLatencyMs: Math.round(totals._avg.latencyMs ?? 0),
      fallbackCalls: fallbackCount,
      tokensIn: totals._sum.tokensIn ?? 0,
      tokensOut: totals._sum.tokensOut ?? 0,
    },
  });
}
