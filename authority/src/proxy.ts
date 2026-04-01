import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { rateLimit } from '@/lib/rate-limit';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
);

const publicRoutes = ['/sign-in', '/sign-up', '/api/auth'];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(route => pathname.startsWith(route));
}

/* ─── Rate-limit configuration ─────────────────────────────── */
const WINDOW_MS = 60_000;
const LIMITS = { auth: 15, api: 60, page: 120 } as const;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return '127.0.0.1';
}

function getTier(pathname: string): keyof typeof LIMITS {
  if (pathname.startsWith('/api/auth')) return 'auth';
  if (pathname.startsWith('/api')) return 'api';
  return 'page';
}

export default async function proxy(req: NextRequest) {
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

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return withRateLimitHeaders(NextResponse.next(), rl);
  }

  // Get auth token from cookie
  const token = req.cookies.get('authority-auth-token')?.value;

  // If no token, redirect to sign-in
  if (!token) {
    const signInUrl = new URL('/sign-in', req.url);
    return NextResponse.redirect(signInUrl);
  }

  try {
    // Verify JWT token
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userRole = payload.role as string;

    // Check role - Authority portal only allows authority roles
    if (userRole === 'CITIZEN') {
      const citizensUrl = process.env.NEXT_PUBLIC_CITIZENS_URL || 'http://localhost:5101';
      return NextResponse.redirect(new URL('/', citizensUrl));
    }

    // Keep the root route from showing the wrong page after login
    if (pathname === "/") {
      const redirectPath =
        userRole === "ADMIN"
          ? "/admin/dashboard"
          : userRole === "WORKER"
            ? "/worker"
            : "/dashboard";
      return NextResponse.redirect(new URL(redirectPath, req.url));
    }

    // Prevent workers from accessing head-only routes
    const headOnlyPrefixes = ["/dashboard", "/incidents", "/workers", "/sla", "/verification", "/analytics", "/audit"];
    if (userRole === "WORKER" && headOnlyPrefixes.some(p => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/worker", req.url));
    }

    // Prevent heads from accessing worker routes
    if (userRole === "AUTHORITY_HEAD" && pathname.startsWith("/worker")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return withRateLimitHeaders(NextResponse.next(), rl);
  } catch (error) {
    // Invalid token, redirect to sign-in
    const response = NextResponse.redirect(new URL('/sign-in', req.url));
    response.cookies.delete('authority-auth-token');
    return response;
  }
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

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
