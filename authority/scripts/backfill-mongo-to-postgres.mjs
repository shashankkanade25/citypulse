import mongoose from "mongoose";
import pg from "pg";

const { Pool } = pg;

const MONGODB_URL = process.env.MONGODB_URL;
const DATABASE_URL = process.env.DATABASE_URL;

if (!MONGODB_URL) {
  throw new Error("Missing MONGODB_URL env var");
}
if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL env var");
}

const BATCH_SIZE = Number.parseInt(process.env.BACKFILL_BATCH_SIZE ?? "250", 10);
const LIMIT = process.env.BACKFILL_LIMIT ? Number.parseInt(process.env.BACKFILL_LIMIT, 10) : null;
const DRY_RUN = (process.env.DRY_RUN ?? "").toLowerCase() === "true";

function toDepartmentCode(name) {
  const cleaned = String(name ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.slice(0, 32) || "GENERAL";
}

function normalizeCategory(value) {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  return upper === "POWER" || upper === "WATER" || upper === "ROAD" ? upper : null;
}

async function main() {
  console.log("Backfill (authority): Mongo incidents -> Postgres incidents");
  console.log(`BATCH_SIZE=${BATCH_SIZE} LIMIT=${LIMIT ?? "(none)"} DRY_RUN=${DRY_RUN}`);

  await mongoose.connect(MONGODB_URL, {
    bufferCommands: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  const pool = new Pool({ connectionString: DATABASE_URL, max: 3 });

  try {
    const incidents = mongoose.connection.db.collection("incidents");

    let processed = 0;
    let lastId = null;

    while (true) {
      const filter = lastId ? { _id: { $gt: lastId } } : {};
      const batch = await incidents.find(filter).sort({ _id: 1 }).limit(BATCH_SIZE).toArray();

      if (batch.length === 0) break;

      for (const doc of batch) {
        if (LIMIT != null && processed >= LIMIT) {
          console.log("Reached BACKFILL_LIMIT, stopping");
          return;
        }

        lastId = doc._id;

        const incidentCode = typeof doc.incidentId === "string" ? doc.incidentId : String(doc._id);
        const departmentName = typeof doc.department === "string" && doc.department.trim() ? doc.department.trim() : "General";
        const departmentCode = toDepartmentCode(departmentName);

        const zone = typeof doc.zone === "string" && doc.zone.trim() ? doc.zone.trim() : "UNKNOWN";

        const title = typeof doc.title === "string" && doc.title.trim() ? doc.title : "(untitled)";
        const description = typeof doc.description === "string" ? doc.description : "";

        const severity = typeof doc.severity === "string" ? doc.severity : null;
        const status = typeof doc.status === "string" ? doc.status : null;

        const createdAt = doc.createdAt ? new Date(doc.createdAt) : new Date();
        const updatedAt = doc.updatedAt ? new Date(doc.updatedAt) : createdAt;

        const metadata = {
          source: "authority-backfill",
          mongo: {
            collection: "incidents",
            _id: String(doc._id),
          },
          images: doc.images ?? [],
          duplicateClusterId: doc.duplicateClusterId ?? null,
        };

        if (DRY_RUN) {
          processed++;
          continue;
        }

        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          const dep = await client.query(
            `INSERT INTO departments(name, code, category, updated_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (code)
             DO UPDATE SET name = EXCLUDED.name, category = COALESCE(EXCLUDED.category, departments.category), updated_at = now()
             RETURNING id`,
            [departmentName, departmentCode, normalizeCategory(doc.category)]
          );
          const departmentId = dep.rows[0]?.id;

          const reasons = Array.isArray(doc.reasons) ? doc.reasons : [];
          const moderation = doc.moderation ?? {};

          await client.query(
            `INSERT INTO incidents(
              incident_code,
              title,
              description,
              severity,
              status,
              department_id,
              zone,
              department_name,
              category,
              speech_to_text,
              confidence_score,
              reasons,
              citizen_external_id,
              citizen_report_count_30d,
              moderation_status,
              moderation_last_action_at,
              moderation_last_remark,
              moderation_citizen_flagged,
              metadata,
              created_at,
              updated_at
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
            )
            ON CONFLICT (incident_code)
            DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              severity = EXCLUDED.severity,
              status = EXCLUDED.status,
              department_id = EXCLUDED.department_id,
              zone = EXCLUDED.zone,
              department_name = EXCLUDED.department_name,
              category = COALESCE(EXCLUDED.category, incidents.category),
              speech_to_text = COALESCE(EXCLUDED.speech_to_text, incidents.speech_to_text),
              confidence_score = COALESCE(EXCLUDED.confidence_score, incidents.confidence_score),
              reasons = EXCLUDED.reasons,
              citizen_external_id = COALESCE(EXCLUDED.citizen_external_id, incidents.citizen_external_id),
              citizen_report_count_30d = COALESCE(EXCLUDED.citizen_report_count_30d, incidents.citizen_report_count_30d),
              moderation_status = COALESCE(EXCLUDED.moderation_status, incidents.moderation_status),
              moderation_last_action_at = COALESCE(EXCLUDED.moderation_last_action_at, incidents.moderation_last_action_at),
              moderation_last_remark = COALESCE(EXCLUDED.moderation_last_remark, incidents.moderation_last_remark),
              moderation_citizen_flagged = COALESCE(EXCLUDED.moderation_citizen_flagged, incidents.moderation_citizen_flagged),
              metadata = EXCLUDED.metadata,
              updated_at = EXCLUDED.updated_at`,
            [
              incidentCode,
              title,
              description,
              severity ?? "MEDIUM",
              status ?? "OPEN",
              departmentId,
              zone,
              departmentName,
              normalizeCategory(doc.category),
              typeof doc.speechToText === "string" ? doc.speechToText : null,
              typeof doc.confidence === "number" ? doc.confidence : null,
              JSON.stringify(reasons),
              typeof doc.citizenId === "string" ? doc.citizenId : null,
              typeof doc.citizenReportCount30d === "number" ? doc.citizenReportCount30d : null,
              typeof moderation.status === "string" ? moderation.status : null,
              moderation.lastActionAt ? new Date(moderation.lastActionAt) : null,
              typeof moderation.lastRemark === "string" ? moderation.lastRemark : null,
              typeof moderation.citizenFlagged === "boolean" ? moderation.citizenFlagged : false,
              JSON.stringify(metadata),
              createdAt,
              updatedAt,
            ]
          );

          await client.query("COMMIT");
          processed++;

          if (processed % 200 === 0) {
            console.log(`Processed ${processed} incidents...`);
          }
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
      }
    }

    console.log(`Done. Total processed: ${processed}`);
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
