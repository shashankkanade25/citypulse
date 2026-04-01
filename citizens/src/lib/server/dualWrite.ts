import type { PoolClient } from "pg";

import { withPgClient } from "@/lib/postgres";

export function isDualWritePostgresEnabled(): boolean {
  return process.env.DUAL_WRITE_POSTGRES === "true";
}

/**
 * When true, Mongo writes are suppressed — PG becomes the sole writer.
 * Set MONGO_READ_ONLY=true once you've validated PG reads (Step 7)
 * and want to stop writing to MongoDB entirely.
 */
export function isMongoReadOnly(): boolean {
  return process.env.MONGO_READ_ONLY === "true";
}

export async function dualWritePostgresFirst<T>(input: {
  pg: (client: PoolClient) => Promise<void>;
  primary: () => Promise<T>;
}): Promise<T> {
  const enabled = isDualWritePostgresEnabled();
  console.log("[dualWrite] DUAL_WRITE_POSTGRES enabled:", enabled, "| env value:", JSON.stringify(process.env.DUAL_WRITE_POSTGRES));
  if (!enabled) {
    if (isMongoReadOnly()) {
      throw new Error(
        "[dualWrite] Both DUAL_WRITE_POSTGRES and MONGO_READ_ONLY are off/on — writes are blocked.",
      );
    }
    return await input.primary();
  }

  return await withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      console.log("[dualWrite] Executing PostgreSQL query...");
      await input.pg(client);
      console.log("[dualWrite] PostgreSQL query succeeded");

      let result: T;
      if (isMongoReadOnly()) {
        result = undefined as unknown as T;
      } else {
        console.log("[dualWrite] Executing MongoDB write...");
        result = await input.primary();
        console.log("[dualWrite] MongoDB write succeeded");
      }

      await client.query("COMMIT");
      console.log("[dualWrite] Transaction committed");
      return result;
    } catch (error) {
      console.error("[dualWrite] Error during dual write:", error);
      try {
        await client.query("ROLLBACK");
        console.log("[dualWrite] Transaction rolled back");
      } catch {
        // ignore rollback errors
      }
      throw error;
    }
  });
}

/**
 * Guard for standalone (non-dual-write) Mongo write paths.
 * Returns true if writes to Mongo are still allowed.
 */
export function mongoWriteAllowed(): boolean {
  if (isMongoReadOnly()) {
    console.warn("[mongoGuard] Write blocked — MONGO_READ_ONLY is enabled.");
    return false;
  }
  return true;
}
