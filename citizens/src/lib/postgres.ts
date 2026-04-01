import { Pool, type PoolClient } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __citypulsePgPoolCitizens: Pool | undefined;
}

function getDatabaseUrl(): string | null {
  return process.env.DATABASE_URL ?? null;
}

export function getPgPool(): Pool {
  if (global.__citypulsePgPoolCitizens) return global.__citypulsePgPoolCitizens;

  let connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  // Remove sslmode from connection string - we'll set it programmatically
  // The pg library's sslmode=require gets mapped to verify-full which fails with Supabase pooler
  connectionString = connectionString.replace(/[?&]sslmode=[^&]*/gi, '');
  
  // Always use SSL with rejectUnauthorized: false for Supabase pooler
  // The Supabase connection pooler uses a self-signed certificate chain
  const pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? "5"),
    ssl: { rejectUnauthorized: false },
  });
  
  console.log("[postgres] Pool created with SSL (rejectUnauthorized: false), cleaned URL");

  global.__citypulsePgPoolCitizens = pool;
  return pool;
}

export async function withPgClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  console.log("[postgres] Getting PG pool...");
  const pool = getPgPool();
  console.log("[postgres] Connecting to pool...");
  const client = await pool.connect();
  console.log("[postgres] Connected to PostgreSQL");
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
