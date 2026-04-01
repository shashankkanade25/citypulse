import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { rateLimit } from '@/lib/rate-limit';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
);

function isProtectedPath(pathname: string) {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/my-reports' ||
    pathname.startsWith('/my-reports/') ||
    pathname === '/reporting' ||
    pathname.startsWith('/reporting/')
  );
}

function isAuthApi(pathname: string) {
  return pathname.startsWith('/api/auth');
}

/* ─── Rate-limit configuration ─────────────────────────────── */
const WINDOW_MS = 60_000;
const LIMITS = { auth: 15, report: 10, api: 60, page: 120 } as const;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return '127.0.0.1';
}

function getTier(pathname: string): keyof typeof LIMITS {
  if (pathname.startsWith('/api/auth')) return 'auth';
  if (pathname.startsWith('/api/report')) return 'report';
  if (pathname.startsWith('/api')) return 'api';
  return 'page';
}

function withRateLimitHeaders(
  res: NextResponse,
  rl: { limit: number; remaining: number; resetAt: number },
) {
  res.headers.set('X-RateLimit-Limit', String(rl.limit));
  res.headers.set('X-RateLimit-Remaining', String(rl.remaining));
  res.headers.set('X-RateLimit-Reset', String(Math.ceil(rl.resetAt / 1000)));
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /* ── Rate limiting ── */
  const ip = getClientIp(req);
  const tier = getTier(pathname);
  const rl = rateLimit(`${tier}:${ip}`, LIMITS[tier], WINDOW_MS);

  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.', retryAfter },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rl.resetAt / 1000)),
        },
      },
    );
  }

  /* ── Auth / routing ── */

  // Never block auth endpoints.
  if (isAuthApi(pathname)) return withRateLimitHeaders(NextResponse.next(), rl);

  const token = req.cookies.get('citizens-auth-token')?.value;
  if (!token) {
    // If route requires auth, redirect to sign-in.
    if (isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }
    return withRateLimitHeaders(NextResponse.next(), rl);
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const role = String(payload.role || '');

    // Citizens portal only supports citizen sessions.
    if (role && role !== 'CITIZEN') {
      const authorityUrl = process.env.NEXT_PUBLIC_AUTHORITY_URL || 'http://localhost:5100';
      return NextResponse.redirect(new URL('/', authorityUrl));
    }

    return withRateLimitHeaders(NextResponse.next(), rl);
  } catch {
    // Invalid token: clear cookie. If this page is protected, go to sign-in.
    if (isProtectedPath(pathname)) {
      const response = NextResponse.redirect(new URL('/sign-in', req.url));
      response.cookies.delete('citizens-auth-token');
      return response;
    }

    const response = withRateLimitHeaders(NextResponse.next(), rl);
    response.cookies.delete('citizens-auth-token');
    return response;
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
