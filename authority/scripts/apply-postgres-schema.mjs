import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getSchemaFiles() {
  // authority/scripts -> repoRoot/infra/postgres/initdb
  const repoRoot = path.resolve(__dirname, "..", "..");
  const initDir = path.resolve(repoRoot, "infra", "postgres", "initdb");

  return [
    path.join(initDir, "00_extensions.sql"),
    path.join(initDir, "10_schema.sql"),
    path.join(initDir, "11_schema_from_ts_models.sql"),
  ];
}

async function main() {
  const databaseUrl = requiredEnv("DATABASE_URL");

  const allowSelfSigned = process.env.PG_INSECURE_SSL === "true";

  if (allowSelfSigned) {
    // Some environments still reject self-signed chains unless the global Node TLS flag is set.
    // This is intentionally *local-only* and must never be enabled in production.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const client = new Client({
    connectionString: databaseUrl,
    // SECURITY:
    // - Default: rely on sslmode in DATABASE_URL (Supabase typically requires SSL).
    // - Opt-in escape hatch for local networks that MITM TLS with a private CA.
    //   Never enable this in production.
    ...(allowSelfSigned ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  const files = getSchemaFiles();

  console.log("Applying PostgreSQL schema files:");
  for (const file of files) console.log(`- ${file}`);

  await client.connect();

  try {
    for (const filePath of files) {
      const sql = await fs.readFile(filePath, "utf8");
      console.log(`\n--- Running ${path.basename(filePath)} ---`);
      await client.query(sql);
      console.log(`OK: ${path.basename(filePath)}`);
    }

    console.log("\n✅ Schema applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\n❌ Failed to apply schema:");
  console.error(err);

  // Common local-network issue: Supabase direct DB host may resolve to IPv6 only.
  // If IPv6 is disabled/unavailable, Node can throw ENOTFOUND.
  if (err && (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN")) {
    console.error("\nTip: If you're using Supabase and the direct host `db.<project-ref>.supabase.co` fails to resolve,");
    console.error("use the Supabase *Connection Pooler* hostname (recommended for Vercel/serverless) from:");
    console.error("Supabase Dashboard → Project Settings → Database → Connection pooling.");
  }

  process.exit(1);
});
