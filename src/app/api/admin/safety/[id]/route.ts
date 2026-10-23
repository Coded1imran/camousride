import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole, ok, fail, zodMessage } from '@/lib/api';

const PatchSchema = z.object({
  status: z.enum(['OPEN', 'ACKED', 'RESOLVED']),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole('ADMIN');
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body.', 400);
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  const incident = await prisma.sOSIncident.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
  });

  return ok({ incident });
}
