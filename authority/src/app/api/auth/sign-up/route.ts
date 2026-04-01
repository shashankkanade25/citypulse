import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/lib/database/models/user.model';
import { hashPassword, createToken, setAuthCookie } from '@/lib/auth';
import { dualWritePostgresFirst } from '@/lib/server/dualWrite';
import { publishEvent, TOPICS } from '@/lib/kafka';

export async function POST(req: NextRequest) {
  try {
    const { username, password, name, email, phone, role } = await req.json();

    // Validate required fields
    if (!username || !password || !name || !email || !role) {
      return NextResponse.json(
        { error: 'Username, password, name, email, and role are required' },
        { status: 400 }
      );
    }

    // Validate username format
    if (username.length < 3 || username.length > 30) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 30 characters' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Validate role - Authority portal only allows authority roles
    if (!['AUTHORITY_HEAD', 'WORKER', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role for Authority Portal' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if username or email already exists
    const existingUser = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }],
    });

    if (existingUser) {
      const field = existingUser.username === username.toLowerCase() ? 'Username' : 'Email';
      return NextResponse.json(
        { error: `${field} already exists` },
        { status: 400 }
      );
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);

    let user: any;
    let pgUserId: string | null = null;

    user = await dualWritePostgresFirst({
      pg: async (client) => {
        const { rows } = await client.query(
          `INSERT INTO users (name, email, username, password_hash, phone, role, is_active, active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, false, false, now(), now())
           RETURNING id, name, email, username, role, is_active AS "isActive"`,
          [name, email.toLowerCase(), username.toLowerCase(), hashedPassword, phone ?? null, role],
        );
        pgUserId = rows[0]?.id;
      },
      primary: async () => {
        return await User.create({
          username: username.toLowerCase(),
          password: hashedPassword,
          name,
          email: email.toLowerCase(),
          phone,
          role,
          isActive: false, // Authority users need admin approval
        });
      },
    });

    // If dualWrite returned undefined (MONGO_READ_ONLY), build user from PG data
    if (!user && pgUserId) {
      user = { _id: pgUserId, username: username.toLowerCase(), name, email: email.toLowerCase(), role, isActive: false };
    }

    // Publish to Kafka for Mongo replication
    publishEvent(TOPICS.USER_CREATED, pgUserId || user?._id?.toString() || email.toLowerCase(), {
      username: username.toLowerCase(),
      name,
      email: email.toLowerCase(),
      phone: phone ?? null,
      role,
      isActive: false,
      passwordHash: hashedPassword,
    });

    // Create JWT token
    const token = await createToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });

    // Set auth cookie
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      message: 'Account created. Awaiting admin approval.',
    });
  } catch (error: any) {
    console.error('Sign-up error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}
