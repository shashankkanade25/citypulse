import Redis from "ioredis";

/*
 * ─── Redis client singleton ─────────────────────────────────────
 *
 *   Uses REDIS_URL env var if set, otherwise defaults to
 *   localhost:6379.  The client is reused across hot-reloads
 *   in development (stored on `globalThis`).
 *
 *   Set REDIS_DISABLED=true to completely bypass Redis and
 *   fall through to the database on every request.
 * ─────────────────────────────────────────────────────────────────
 */

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const REDIS_DISABLED = process.env.REDIS_DISABLED === "true";

// Extend globalThis for dev hot-reload persistence
const globalForRedis = globalThis as unknown as {
  __redis?: Redis;
};

function createRedisClient(): Redis {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null; // stop retrying after 5 attempts
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
    enableReadyCheck: true,
    connectTimeout: 5000,
  });

  client.on("error", (err) => {
    console.warn("[Redis] Connection error (will fall through to DB):", err.message);
  });

  client.on("connect", () => {
    console.log("[Redis] Connected to", REDIS_URL);
  });

  return client;
}

/**
 * Returns the Redis client singleton.
 * Returns `null` when Redis is explicitly disabled.
 */
export function getRedisClient(): Redis | null {
  if (REDIS_DISABLED) return null;

  if (!globalForRedis.__redis) {
    globalForRedis.__redis = createRedisClient();
  }

  return globalForRedis.__redis;
}

export { REDIS_DISABLED };
export default getRedisClient;
