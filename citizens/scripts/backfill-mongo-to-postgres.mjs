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

function extractLatLng(doc) {
  const loc = doc?.location;
  if (!loc || typeof loc !== "object") return { latitude: null, longitude: null };

  const latitude = typeof loc.latitude === "number" ? loc.latitude : typeof loc.lat === "number" ? loc.lat : null;
  const longitude = typeof loc.longitude === "number" ? loc.longitude : typeof loc.lng === "number" ? loc.lng : null;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return { latitude: null, longitude: null };
  }
  return { latitude, longitude };
}

async function main() {
  console.log("Backfill (citizens): Mongo issues -> Postgres incidents");
  console.log(`BATCH_SIZE=${BATCH_SIZE} LIMIT=${LIMIT ?? "(none)"} DRY_RUN=${DRY_RUN}`);

  await mongoose.connect(MONGODB_URL, {
    bufferCommands: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  const pool = new Pool({ connectionString: DATABASE_URL, max: 3 });

  try {
    const issues = mongoose.connection.db.collection("issues");

    let processed = 0;
    let lastId = null;

    while (true) {
      const filter = lastId ? { _id: { $gt: lastId } } : {};
      const batch = await issues.find(filter).sort({ _id: 1 }).limit(BATCH_SIZE).toArray();

      if (batch.length === 0) break;

      for (const doc of batch) {
        if (LIMIT != null && processed >= LIMIT) {
          console.log("Reached BACKFILL_LIMIT, stopping");
          return;
        }

        lastId = doc._id;

        const departmentName =
          typeof doc.department === "string" && doc.department.trim()
            ? doc.department.trim()
            : normalizeCategory(doc.category) ?? "General";
        const departmentCode = toDepartmentCode(departmentName);
        const category = normalizeCategory(doc.category);

        const zone = typeof doc.zone === "string" && doc.zone.trim() ? doc.zone.trim() : "UNKNOWN";

        const { latitude, longitude } = extractLatLng(doc);

        const incidentCode = String(doc._id);
        const title = typeof doc.title === "string" && doc.title.trim() ? doc.title : "(untitled)";
        const description = typeof doc.description === "string" ? doc.description : "";

        const severity = typeof doc.severityLevel === "string" ? doc.severityLevel : null;
        const status = typeof doc.status === "string" ? doc.status : null;

        const createdAt = doc.createdAt ? new Date(doc.createdAt) : new Date();
        const updatedAt = doc.updatedAt ? new Date(doc.updatedAt) : createdAt;

        const citizenExternalId = typeof doc.clerkId === "string" ? doc.clerkId : null;

        const metadata = {
          source: "citizens-backfill",
          mongo: {
            collection: "issues",
            _id: incidentCode,
          },
          raw: doc,
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
            [departmentName, departmentCode, category]
          );
          const departmentId = dep.rows[0]?.id;

          let groupedIncidentId = null;
          const radiusMeters = Number.parseFloat(process.env.DUP_RADIUS_METERS ?? "100");
          const windowHours = Number.parseFloat(process.env.DUP_WINDOW_HOURS ?? "24");

          if (typeof latitude === "number" && typeof longitude === "number") {
            const dup = await client.query(
              `SELECT id
               FROM incidents
               WHERE location IS NOT NULL
                 AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
                 AND created_at >= now() - make_interval(hours => $4)
                 AND ($5::text IS NULL OR category = $5)
               ORDER BY created_at DESC
               LIMIT 1`,
              [longitude, latitude, radiusMeters, windowHours, category]
            );
            groupedIncidentId = dup.rows[0]?.id ?? null;
          }

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
              confidence_score,
              citizen_external_id,
              latitude,
              longitude,
              grouped_incident_id,
              metadata,
              created_at,
              updated_at
            ) VALUES (
              $1,$2,$3,
              COALESCE($4,'MEDIUM'),
              COALESCE($5,'OPEN'),
              $6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
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
              confidence_score = EXCLUDED.confidence_score,
              citizen_external_id = COALESCE(EXCLUDED.citizen_external_id, incidents.citizen_external_id),
              latitude = COALESCE(EXCLUDED.latitude, incidents.latitude),
              longitude = COALESCE(EXCLUDED.longitude, incidents.longitude),
              grouped_incident_id = COALESCE(EXCLUDED.grouped_incident_id, incidents.grouped_incident_id),
              metadata = EXCLUDED.metadata,
              updated_at = EXCLUDED.updated_at`,
            [
              incidentCode,
              title,
              description,
              severity,
              status,
              departmentId,
              zone,
              departmentName,
              category,
              typeof doc.aiConfidence === "number" ? doc.aiConfidence : null,
              citizenExternalId,
              latitude,
              longitude,
              groupedIncidentId,
              JSON.stringify(metadata),
              createdAt,
              updatedAt,
            ]
          );

          await client.query("COMMIT");
          processed++;

          if (processed % 200 === 0) {
            console.log(`Processed ${processed} issues...`);
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
