import { NextResponse } from 'next/server';
import { removeAuthCookie } from '@/lib/auth';

export async function POST() {
  try {
    await removeAuthCookie();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Sign-out error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sign out' },
      { status: 500 }
    );
  }
}
