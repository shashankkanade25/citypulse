/**
 * In-memory sliding-window rate limiter.
 * Zero dependencies — works with Next.js middleware at the Edge.
 *
 * Two tiers:
 *   • API routes  (/api/*)  — 60 requests per 60 s per IP
 *   • Page routes           — 120 requests per 60 s per IP
 *
 * A stale-entry cleanup runs automatically every 60 s.
 */

export interface RateLimitEntry {
  /** Timestamps of requests inside the current window */
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 60 s so memory doesn't grow unbounded
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Unix-ms when the oldest request in the window expires */
  resetAt: number;
  limit: number;
}

/**
 * Check (and record) a request against the rate limit.
 *
 * @param key     Unique identifier (usually IP + route tier)
 * @param limit   Max requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  cleanup(windowMs);

  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Drop timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldest + windowMs,
      limit,
    };
  }

  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    resetAt: entry.timestamps[0] + windowMs,
    limit,
  };
}
