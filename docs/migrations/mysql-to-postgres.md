# CityPulse — MySQL → PostgreSQL Migration (OLTP)

Date: 2026-02-07

## Purpose
This document defines the **reviewed** migration path to move CityPulse’s primary transactional store from **MySQL** to **PostgreSQL (>= 14)**.

Non-negotiables:
- **No data loss**
- **No business logic changes**
- **No breaking API changes**
- **No relaxation of access control**
- **Historical data remains immutable**
- **MySQL stays online** until PostgreSQL is fully verified

Target end state:
- **PostgreSQL = single source of truth (OLTP)**
- **MySQL = deprecated (kept as snapshot/fallback until fully retired)**
- **MongoDB = read-only derived analytics**
- **Kafka = immutable event stream from PostgreSQL commits**

> Note: The current repo contains MongoDB/Mongoose usage for several features. That does not change this migration plan; it means transactional entities should be moved behind a relational data layer while Mongo becomes derived/read-only.

---

## Step 1 — Prepare PostgreSQL (no production traffic yet)

1. Provision PostgreSQL **>= 14**.
2. Enable extensions:
   - `uuid-ossp`
   - `pgcrypto`
   - `postgis`
3. Provision separate credentials and a separate database for staging migration verification.
4. Do **not** route production reads/writes to PostgreSQL yet.

Dev shortcut (local): use [infra/postgres/docker-compose.yml](../../infra/postgres/docker-compose.yml).

Quickstart:
```bash
cd infra/postgres
docker compose up -d
```

The init scripts in `infra/postgres/initdb/` run automatically on first boot.

---

## Step 2 — Translate Schema (do not copy blindly)

Conversion rules:
- `INT AUTO_INCREMENT` → `UUID` (`gen_random_uuid()`)
- `ENUM` → `CHECK` constraints
- `DATETIME` → `TIMESTAMP WITH TIME ZONE` (`TIMESTAMPTZ`)
- `JSON` → `JSONB`
- Foreign keys: **STRICT**, with `ON DELETE RESTRICT` where applicable
- Audit/history tables: **append-only** (no `UPDATE` / `DELETE`)

---

## Step 3 — Create PostgreSQL Schema

Apply schema in this order:
1. `users`
2. `departments`
3. `incidents`
4. `incident_reports`
5. `incident_status_history`
6. `incident_assignments`
7. `worker_updates`
8. `audit_logs`

Schema SQL lives in:
- [infra/postgres/initdb/00_extensions.sql](../../infra/postgres/initdb/00_extensions.sql)
- [infra/postgres/initdb/10_schema.sql](../../infra/postgres/initdb/10_schema.sql)
- [infra/postgres/initdb/11_schema_from_ts_models.sql](../../infra/postgres/initdb/11_schema_from_ts_models.sql)

### Production apply (no Docker)

For Vercel/Render deployments, apply the schema **outside** the web runtime (one-time or via CI):

Option A — `psql` (local/CI):
```bash
psql "$DATABASE_URL" -f infra/postgres/initdb/00_extensions.sql
psql "$DATABASE_URL" -f infra/postgres/initdb/10_schema.sql
psql "$DATABASE_URL" -f infra/postgres/initdb/11_schema_from_ts_models.sql
```

Option B — Node script in this repo (recommended if you don’t want `psql`):
```bash
cd authority
npm run db:schema:apply
```

Required env vars:
- `DATABASE_URL=postgresql://...`

Notes (Supabase + Vercel):
- Prefer Supabase **Connection Pooler** connection string for serverless (Vercel) to avoid connection spikes.
- Include `?sslmode=require` (or `?sslmode=verify-full`) for managed databases.
- For local Postgres without TLS, use `?sslmode=disable`.

If you see `SELF_SIGNED_CERT_IN_CHAIN` while applying schema locally:
- Your network is likely doing TLS inspection (corporate proxy / custom root CA).
- Preferred: apply the SQL using Supabase **SQL Editor** (runs inside Supabase).
- Alternative (local only): set `PG_INSECURE_SSL=true` when running `npm run db:schema:apply`.

---

## Step 4 — Dual-Write Mode (temporary)

During the migration window:
- **Writes** go to MySQL + PostgreSQL
- **Reads** stay on MySQL

Implementation requirements:
- Wrap each write in transactions.
- Never acknowledge success to callers unless both writes succeed.
- Any PostgreSQL failure must prevent the MySQL commit.

Important note on correctness:
- A strict “rollback the other DB after commit” guarantee is not possible without a distributed transaction coordinator (2PC).
- The safe approach is:
  - Stage writes in both DB transactions
  - Commit the DB designated as the “read source” **last** (MySQL during the window)
  - If the earlier commit succeeds but the last commit fails, **raise a fatal alert** and record a compensating reconciliation task (do not continue silently).

This keeps user-visible state consistent (reads are from MySQL), and prevents silent divergence.

---

## Step 5 — Data Backfill (historical)

For each table, table-by-table:
1. Export from MySQL.
2. Transform:
   - IDs → UUIDs (use deterministic mapping table so FKs remain consistent)
   - timestamps → UTC
3. Import into PostgreSQL.
4. Validate:
   - Row counts
   - FK integrity
   - Status history completeness

---

## Step 6 — PostGIS + Duplicate Detection

Schema adds `incidents.location GEOGRAPHY(Point, 4326)`.

Populate from lat/lon:
- Trigger updates `location` on insert/update.

Spatial index:
- `GIST(location)`

Example duplicate query (radius-based):
```sql
SELECT i2.id, i2.created_at
FROM incidents i1
JOIN incidents i2 ON i2.id <> i1.id
WHERE i1.id = $1
  AND i2.created_at >= (now() - interval '24 hours')
  AND ST_DWithin(i1.location, i2.location, 150) -- meters
  AND i2.department_id = i1.department_id;
```

---

## Step 7 — Switch Reads to PostgreSQL (feature-flagged)

Switch adapters incrementally under feature flags:
- Incident creation
- Status transitions
- Assignments

Monitor:
- Latency
- Deadlocks
- Transaction failures

---

## Step 8 — Lock Down MySQL (read-only)

- Disable writes to MySQL.
- Keep MySQL as fallback snapshot.
- PostgreSQL is authoritative.

---

## Step 9 — Kafka Integration (post-migration)

Emit events **only** from PostgreSQL commits (transactional outbox pattern recommended):
- `INCIDENT_CREATED`
- `STATUS_CHANGED`
- `WORKER_ASSIGNED`

MongoDB consumers update derived analytics.
Events must be immutable + replayable.

---

## Data Integrity & Security Requirements

- Status transitions must enforce a strict state machine.
- Unauthorized roles must never mutate incident state.
- Admins cannot delete incidents.
- All actions must create audit log entries.
- Rollbacks must not leave partial state.

---

## Validation Checklist

Before declaring migration complete:
- Incident lifecycle enforces valid transitions
- Duplicate incident grouping works (PostGIS)
- Worker updates remain append-only
- Public dashboard reflects real-time updates
- Audit logs cannot be edited or deleted
- Concurrent incident creation does not deadlock

---

## What NOT to do

- Do not auto-convert schema without review
- Do not drop MySQL early
- Do not weaken constraints for speed
- Do not move analytics logic into PostgreSQL
- Do not bypass Kafka for state changes
