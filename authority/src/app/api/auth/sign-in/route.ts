import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/lib/database/models/user.model';
import { verifyPassword, createToken, setAuthCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find user by username
    const user = await User.findOne({ username: username.toLowerCase() });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Check role - Authority portal only allows authority roles
    if (user.role === 'CITIZEN') {
      return NextResponse.json(
        { error: 'Please use the Citizens Portal to sign in' },
        { status: 403 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is pending admin approval. Please contact your administrator.' },
        { status: 403 }
      );
    }

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
      },
      redirectTo:
        user.role === "ADMIN"
          ? "/admin/dashboard"
          : user.role === "WORKER"
            ? "/worker"
            : "/dashboard",
    });
  } catch (error: any) {
    console.error('Sign-in error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sign in' },
      { status: 500 }
    );
  }
}
