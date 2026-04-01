import { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/database/mongoose';
import User from '@/lib/database/models/user.model';
import { errorResponse, successResponse, unauthorizedResponse, validationErrorResponse } from '@/lib/utils/response';
import { createToken, setAuthCookie, verifyPassword } from '@/lib/auth';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}   

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse('Invalid JSON body', 400);

    const rawIdentifier = String(body.identifier || body.email || body.username || '').trim();
    const password = String(body.password || '');

    const fieldErrors: Record<string, string[]> = {};
    if (!rawIdentifier) fieldErrors.identifier = ['email or username is required'];
    if (!password) fieldErrors.password = ['password is required'];
    if (Object.keys(fieldErrors).length) return validationErrorResponse(fieldErrors);

    await connectToDatabase();

    const isEmail = rawIdentifier.includes('@');
    const query = isEmail
      ? { email: normalizeEmail(rawIdentifier) }
      : { username: normalizeUsername(rawIdentifier) };

    const user = await User.findOne(query).select('_id email name role password isActive username');
    if (!user) return unauthorizedResponse('Invalid credentials');
    if (!user.isActive) return unauthorizedResponse('Account is disabled');
    if (user.role !== 'CITIZEN') return unauthorizedResponse('Only citizens can sign in here');

    const ok = await verifyPassword(password, user.password);
    if (!ok) return unauthorizedResponse('Invalid credentials');

    const token = await createToken({
      userId: String(user._id),
      email: user.email,
      role: user.role,
      name: user.name,
    });
    await setAuthCookie(token);

    return successResponse(
      {
        userId: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
      },
      'Signed in successfully'
    );
  } catch (err: any) {
    return errorResponse(err?.message || 'Failed to sign in', 500);
  }
}
