import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from './auth';

export const TOKEN_COOKIE = 'campusride_token';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(error: string, status = 400, details?: unknown) {
  return NextResponse.json({ success: false, error, details }, { status });
}

export function zodMessage(error: unknown) {
  const issues =
    typeof error === 'object' && error && 'issues' in error && Array.isArray((error as { issues?: unknown[] }).issues)
      ? ((error as { issues: Array<{ path?: Array<string | number | symbol>; message?: string }> }).issues)
      : [];

  return issues
    .map((issue) => {
      const path = Array.isArray(issue.path) ? issue.path.filter((segment) => typeof segment !== 'symbol').join('.') : '';
      const message = issue.message ?? 'Validation failed';
      return `${path || 'body'}: ${message}`;
    })
    .join('; ');
}

export async function currentUser() {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  return getSessionUser(token);
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) return { error: fail('Unauthorized — please log in.', 401) } as const;
  return { user } as const;
}

export function setAuthCookie(token: string) {
  cookies().set({
    name: TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production',
  });
}

export function clearAuthCookie() {
  cookies().set({
    name: TOKEN_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });
}

export type Role = 'STUDENT' | 'DRIVER' | 'ADMIN';

export async function requireRole(...roles: Role[]) {
  const user = await currentUser();
  if (!user) return { error: fail('Unauthorized — please log in.', 401) } as const;
  if (roles.length && !roles.includes(user.role as Role)) {
    return { error: fail('Forbidden — your role cannot perform this action.', 403) } as const;
  }
  return { user } as const;
}
