import { Pool, type PoolClient } from "pg";

declare global {
  // biome-ignore lint: must use var for global augmentation
  var __citypulsePgPool: Pool | undefined;
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

export function getPgPool(): Pool {
  if (global.__citypulsePgPool) return global.__citypulsePgPool;

  let connectionString = requireDatabaseUrl();
  // Remove sslmode from connection string - we'll set it programmatically
  connectionString = connectionString.replace(/[?&]sslmode=[^&]*/gi, '');
  
  // Always use SSL with rejectUnauthorized: false for Supabase pooler
  const pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? "5"),
    ssl: { rejectUnauthorized: false },
  });

  global.__citypulsePgPool = pool;
  return pool;
}

export async function withPgClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
