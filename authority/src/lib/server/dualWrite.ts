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
  if (!isDualWritePostgresEnabled()) {
    // PG disabled — write only to Mongo (unless Mongo is also locked)
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
      await input.pg(client);

      // Skip Mongo write when MONGO_READ_ONLY is enabled
      let result: T;
      if (isMongoReadOnly()) {
        result = undefined as unknown as T;
      } else {
        result = await input.primary();
      }

      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
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
 * When MONGO_READ_ONLY=true, logs a warning and returns false.
 *
 * Usage:
 *   if (!mongoWriteAllowed()) return;
 *   await SomeModel.create(...);
 */
export function mongoWriteAllowed(): boolean {
  if (isMongoReadOnly()) {
    console.warn("[mongoGuard] Write blocked — MONGO_READ_ONLY is enabled.");
    return false;
  }
  return true;
}
