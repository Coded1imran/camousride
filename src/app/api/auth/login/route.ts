import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, signToken } from '@/lib/auth';
import { LoginSchema } from '@/lib/validation/schemas';
import { ok, fail, zodMessage, setAuthCookie } from '@/lib/api';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body.', 400);
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return fail('Invalid email or password.', 401);

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return fail('Invalid email or password.', 401);

  const token = signToken(user.id, user.email, user.role);
  setAuthCookie(token);

  return ok({
    user: { id: user.id, email: user.email, role: user.role, name: user.name },
    token,
  });
}
