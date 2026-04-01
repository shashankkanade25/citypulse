import { getCurrentUser } from '@/lib/auth';
import { successResponse, unauthorizedResponse } from '@/lib/utils/response';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse('Not signed in');
  return successResponse(user);
}
