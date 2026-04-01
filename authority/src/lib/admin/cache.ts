import { getRedisClient } from "@/lib/redis";

/*
 * ─── Admin Redis Cache Helper ────────────────────────────────────
 *
 *   Provides a simple cache-aside pattern for admin API routes:
 *
 *     const data = await cacheGet("admin:dashboard", 30, fetchFromDB);
 *
 *   If Redis is unavailable or disabled, falls through to the
 *   fetcher function transparently — the app never breaks.
 *
 *   Cache keys are namespaced under "citypulse:admin:" to avoid
 *   collisions.
 *
 *   TTLs (in seconds):
 *     Dashboard / Analytics  : 30s   (frequently changing stats)
 *     Registry / Flagged     : 20s   (search-heavy, needs freshness)
 *     Users / Workers / Heads: 60s   (less volatile)
 *     Departments            : 120s  (rarely changes)
 *     Config                 : 300s  (very stable)
 *     Audit logs             : 30s
 *     Abuse cases            : 60s
 * ─────────────────────────────────────────────────────────────────
 */

const KEY_PREFIX = "citypulse:admin:";

/** Default TTLs per cache domain (seconds) */
export const CACHE_TTLS = {
  dashboard: 30,
  analytics: 30,
  registry: 20,
  flagged: 20,
  users: 60,
  workers: 60,
  "authority-heads": 60,
  departments: 120,
  config: 300,
  audit: 30,
  "audit-logs": 30,
  abuse: 60,
  moderation: 20,
} as const;

export type CacheDomain = keyof typeof CACHE_TTLS;

/**
 * Build a namespaced cache key.
 * @example cacheKey("dashboard")             → "citypulse:admin:dashboard"
 * @example cacheKey("registry", "q=fire&zone=Zone-1") → "citypulse:admin:registry:q=fire&zone=Zone-1"
 */
export function cacheKey(domain: CacheDomain, suffix?: string): string {
  const base = `${KEY_PREFIX}${domain}`;
  return suffix ? `${base}:${suffix}` : base;
}

/**
 * Cache-aside GET.
 *
 * 1. Try Redis → return parsed JSON if hit.
 * 2. On miss or Redis error → call `fetcher()`.
 * 3. Store the fetcher result in Redis with the given TTL.
 *
 * If Redis is unreachable the function silently falls through —
 * the API always returns data.
 */
export async function cacheGet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      console.warn("[Cache] GET error, falling through:", (err as Error).message);
    }
  }

  // Cache miss or Redis unavailable — fetch fresh data
  const data = await fetcher();

  // Store in background (fire-and-forget)
  if (redis) {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(data));
    } catch (err) {
      console.warn("[Cache] SET error:", (err as Error).message);
    }
  }

  return data;
}

/**
 * Manually set a cache entry.
 */
export async function cacheSet(
  key: string,
  ttlSeconds: number,
  data: unknown,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    console.warn("[Cache] SET error:", (err as Error).message);
  }
}

/**
 * Invalidate one or more cache keys.
 * Supports exact keys or glob patterns (e.g. "citypulse:admin:users*").
 */
export async function cacheInvalidate(...patterns: string[]): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    for (const pattern of patterns) {
      if (pattern.includes("*")) {
        // Use SCAN + DEL for glob patterns (safe in production)
        let cursor = "0";
        do {
          const [nextCursor, keys] = await redis.scan(
            cursor,
            "MATCH",
            pattern,
            "COUNT",
            200,
          );
          cursor = nextCursor;
          if (keys.length > 0) {
            await redis.del(...keys);
          }
        } while (cursor !== "0");
      } else {
        await redis.del(pattern);
      }
    }
  } catch (err) {
    console.warn("[Cache] INVALIDATE error:", (err as Error).message);
  }
}

/**
 * Invalidate all cache entries for one or more admin domains.
 * @example invalidateDomain("dashboard", "analytics")
 */
export async function invalidateDomain(
  ...domains: CacheDomain[]
): Promise<void> {
  const patterns = domains.map((d) => `${KEY_PREFIX}${d}*`);
  await cacheInvalidate(...patterns);
}

/**
 * Invalidate ALL admin cache entries.
 */
export async function invalidateAllAdminCache(): Promise<void> {
  await cacheInvalidate(`${KEY_PREFIX}*`);
}
