import { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/database/mongoose';
import User from '@/lib/database/models/user.model';
import { conflictResponse, errorResponse, successResponse, validationErrorResponse } from '@/lib/utils/response';
import { createToken, hashPassword, setAuthCookie } from '@/lib/auth';
import { dualWritePostgresFirst } from '@/lib/server/dualWrite';
import { publishEvent, TOPICS } from '@/lib/kafka';

function mapRegisterError(err: unknown): { message: string; status: number } {
  const raw = err instanceof Error ? err.message : String(err || 'Unknown error');
  const lower = raw.toLowerCase();

  if (lower.includes('please define the mongodb_url environment variable')) {
    return {
      message: 'Server is missing MONGODB_URL. Add it to citizens/.env.local and restart the app.',
      status: 500,
    };
  }

  if (
    lower.includes('tenant or user not found') ||
    lower.includes('password authentication failed') ||
    lower.includes('database_url is not set')
  ) {
    return {
      message:
        'PostgreSQL authentication failed. Verify DATABASE_URL, username/password, and tenant/project settings, or set DUAL_WRITE_POSTGRES=false for Mongo-only mode.',
      status: 500,
    };
  }

  return { message: raw || 'Failed to register', status: 500 };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function baseUsernameFromEmail(email: string) {
  const local = normalizeEmail(email).split('@')[0] || 'citizen';
  const cleaned = local.replace(/[^a-z0-9._]/g, '').replace(/\.+/g, '.');
  const candidate = cleaned.length >= 3 ? cleaned : `citizen_${cleaned || 'user'}`;
  return candidate.slice(0, 30);
}

async function generateUniqueUsername(email: string) {
  const base = baseUsernameFromEmail(email);
  const existing = await User.findOne({ username: base }).select('_id');
  if (!existing) return base;

  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = String(Math.floor(100 + Math.random() * 900));
    const candidate = `${base.slice(0, Math.max(0, 30 - 4))}_${suffix}`.slice(0, 30);
    const taken = await User.findOne({ username: candidate }).select('_id');
    if (!taken) return candidate;
  }

  // Last resort: timestamp-based suffix
  const suffix = String(Date.now()).slice(-6);
  return `${base.slice(0, Math.max(0, 30 - 7))}_${suffix}`.slice(0, 30);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse('Invalid JSON body', 400);

    const name = String(body.name || '').trim();
    const email = normalizeEmail(String(body.email || ''));
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');

    const fieldErrors: Record<string, string[]> = {};
    if (!name) fieldErrors.name = ['name is required'];
    if (!email) fieldErrors.email = ['email is required'];
    if (!password) fieldErrors.password = ['password is required'];
    if (password && password.length < 6) fieldErrors.password = ['password must be at least 6 characters'];
    if (Object.keys(fieldErrors).length) return validationErrorResponse(fieldErrors);

    const dualWriteEnabled = process.env.DUAL_WRITE_POSTGRES === 'true';
    const mongoReadOnly = process.env.MONGO_READ_ONLY === 'true';

    // This auth route still depends on Mongo user reads after write.
    if (dualWriteEnabled && mongoReadOnly) {
      return errorResponse(
        'Signup is not supported with MONGO_READ_ONLY=true in Citizens auth flow. Set MONGO_READ_ONLY=false or implement PostgreSQL-based auth reads.',
        500
      );
    }

    await connectToDatabase();

    const existing = await User.findOne({ email }).select('role');
    if (existing) return conflictResponse('An account with this email already exists');

    const username = await generateUniqueUsername(email);
    const passwordHash = await hashPassword(password);

    const user = await dualWritePostgresFirst({
      pg: async (client) => {
        await client.query(
          `INSERT INTO users (name, email, username, password_hash, phone, role, is_active, active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'CITIZEN', true, true, now(), now())
           ON CONFLICT (email) DO NOTHING`,
          [name, email, username, passwordHash, phone || null]
        );
      },
      primary: async () => {
        return await User.create({
          username,
          password: passwordHash,
          name,
          email,
          phone: phone || undefined,
          role: 'CITIZEN',
          isActive: true,
        });
      },
    });

    // Publish to Kafka so consumer can replicate to Mongo (if dual-write skipped Mongo)
    publishEvent(TOPICS.USER_CREATED, user?._id?.toString() || email, {
      username,
      name,
      email,
      phone: phone || undefined,
      role: 'CITIZEN',
      isActive: true,
      passwordHash,
    });

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
      'Registered successfully'
    );
  } catch (err: any) {
    // Handle duplicate key (unique email/username)
    if (err?.code === 11000) return conflictResponse('Account already exists');
    const mapped = mapRegisterError(err);
    return errorResponse(mapped.message, mapped.status);
  }
}
