import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser } from './auth';
import { TOKEN_COOKIE } from './api';

export async function getSession() {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  return getSessionUser(token);
}

export async function requireSession() {
  const user = await getSession();
  if (!user) redirect('/login');
  return user;
}

export async function requirePageRole(...roles: Array<'STUDENT' | 'DRIVER' | 'ADMIN'>) {
  const user = await requireSession();
  if (roles.length && !roles.includes(user.role as 'STUDENT' | 'DRIVER' | 'ADMIN')) {
    redirect('/dashboard');
  }
  return user;
}
