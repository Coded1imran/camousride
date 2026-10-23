import { prisma } from './prisma';

export type RideStatusValue = 'REQUESTED' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

const TRANSITIONS: Record<RideStatusValue, RideStatusValue[]> = {
  REQUESTED: ['MATCHED', 'CANCELLED'],
  MATCHED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: RideStatusValue, to: RideStatusValue): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export async function resolveZone(name: string): Promise<string> {
  if (!name) return 'Central';
  const exact = await prisma.campusLocation.findFirst({ where: { name: { equals: name } } });
  if (exact) return exact.zone;
  const partial = await prisma.campusLocation.findFirst({ where: { name: { contains: name } } });
  if (partial) return partial.zone;
  const words = name
    .replace(/(faculty of|hall|gate|centre|center|building)/gi, '')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  for (const w of words) {
    const match = await prisma.campusLocation.findFirst({ where: { name: { contains: w } } });
    if (match) return match.zone;
  }
  return 'Central';
}

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
