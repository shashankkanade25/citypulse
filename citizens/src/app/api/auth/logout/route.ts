import { removeAuthCookie } from '@/lib/auth';
import { successResponse } from '@/lib/utils/response';

export async function POST() {
  await removeAuthCookie();
  return successResponse({ ok: true }, 'Signed out');
}
