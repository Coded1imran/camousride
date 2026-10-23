import { ok, fail, currentUser } from '@/lib/api';

export async function GET() {
  const user = await currentUser();
  if (!user) return fail('Unauthorized', 401);
  return ok({ user });
}
