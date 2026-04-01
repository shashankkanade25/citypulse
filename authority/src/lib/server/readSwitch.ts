import { withPgClient } from "@/lib/postgres";

/**
 * Feature flag controlling whether GET / read endpoints use Postgres
 * instead of MongoDB. Enable by setting READ_FROM_POSTGRES=true.
 */
export function isReadFromPostgres(): boolean {
  return process.env.READ_FROM_POSTGRES === "true";
}

/**
 * Convenience: run a read-only Postgres query if the flag is on,
 * otherwise fall through to the Mongo path (caller handles that).
 *
 * Returns `null` when the flag is off so the caller knows to run Mongo.
 */
export async function pgReadOrNull<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T | null> {
  if (!isReadFromPostgres()) return null;
  return withPgClient(fn);
}
