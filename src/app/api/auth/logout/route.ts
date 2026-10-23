import { ok, clearAuthCookie } from '@/lib/api';

export async function POST() {
  clearAuthCookie();
  return ok({ loggedOut: true });
}
