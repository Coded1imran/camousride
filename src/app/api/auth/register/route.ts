import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, signToken } from '@/lib/auth';
import { RegisterSchema } from '@/lib/validation/schemas';
import { ok, fail, zodMessage, setAuthCookie } from '@/lib/api';

const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON body.', 400);
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) return fail(zodMessage(parsed.error), 422);
  const { email, password, name, role, phone, department, hostel } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  if (ALLOWED_DOMAINS.length > 0) {
    const domainOk = ALLOWED_DOMAINS.some((d) => normalizedEmail.endsWith(`@${d}`));
    if (!domainOk) {
      return fail(`Please register with a university email (${ALLOWED_DOMAINS.join(', ')}).`, 422);
    }
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return fail('An account with that email already exists.', 409);

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: name.trim(),
      role,
      phone: phone?.trim() || null,
      department: department?.trim() || null,
      hostel: hostel?.trim() || null,
    },
    select: { id: true, email: true, role: true, name: true },
  });

  const token = signToken(user.id, user.email, user.role);
  setAuthCookie(token);
  return ok({ user, token }, 201);
}
