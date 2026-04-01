-- Schema overlay derived from current Mongoose .ts models
-- This file intentionally *augments* 10_schema.sql rather than replacing it.
-- Goal: align PostgreSQL OLTP schema with the fields + constraints present in `src/lib/database/models/*`.

BEGIN;

-- -----------------
-- users (authority/citizens)
-- -----------------

ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS zone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo text;

-- Keep existing column `active` for backward compatibility; prefer `is_active` going forward.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
  END IF;
END $$;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('CITIZEN','AUTHORITY_HEAD','WORKER','ADMIN','AUDITOR','AUTHORITY'));

CREATE UNIQUE INDEX IF NOT EXISTS users_username_uniq_idx ON users(username);

-- FK to departments (STRICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_department_fk'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_department_fk
      FOREIGN KEY (department_id)
      REFERENCES departments(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_role_active_idx ON users(role, is_active);

-- -----------------
-- departments (authority/citizens)
-- -----------------

ALTER TABLE departments ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS head_id uuid;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'departments_category_check'
  ) THEN
    ALTER TABLE departments DROP CONSTRAINT departments_category_check;
  END IF;
END $$;

ALTER TABLE departments
  ADD CONSTRAINT departments_category_check
  CHECK (category IS NULL OR category IN ('POWER','WATER','ROAD'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'departments_head_fk'
  ) THEN
    ALTER TABLE departments
      ADD CONSTRAINT departments_head_fk
      FOREIGN KEY (head_id)
      REFERENCES users(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS departments_category_idx ON departments(category);

-- Workers array in Mongoose -> join table in PostgreSQL
CREATE TABLE IF NOT EXISTS department_workers (
  department_id uuid NOT NULL,
  worker_user_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (department_id, worker_user_id),

  CONSTRAINT department_workers_department_fk FOREIGN KEY (department_id)
    REFERENCES departments(id)
    ON DELETE RESTRICT,

  CONSTRAINT department_workers_user_fk FOREIGN KEY (worker_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS department_workers_user_idx ON department_workers(worker_user_id);

-- -----------------
-- incidents (citizens + authority/admin)
-- -----------------

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS reported_by_user_id uuid;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS speech_to_text text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS confidence_score double precision;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS reasons jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS citizen_external_id text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS citizen_report_count_30d integer;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS moderation_status text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS moderation_last_action_at timestamptz;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS moderation_last_remark text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS moderation_citizen_flagged boolean NOT NULL DEFAULT false;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS grouped_incident_id uuid;

-- Align department reference: Mongoose uses both `departmentId` and `department` (name)
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS department_name text;

-- Severity/status variants exist in code; enforce a superset CHECK (still strict, but compatible)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'incidents_severity_check'
  ) THEN
    ALTER TABLE incidents DROP CONSTRAINT incidents_severity_check;
  END IF;
END $$;

ALTER TABLE incidents
  ADD CONSTRAINT incidents_severity_check
  CHECK (severity IN ('LOW','MEDIUM','HIGH','Low','Medium','High','Critical'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'incidents_status_check'
  ) THEN
    ALTER TABLE incidents DROP CONSTRAINT incidents_status_check;
  END IF;
END $$;

ALTER TABLE incidents
  ADD CONSTRAINT incidents_status_check
  CHECK (status IN (
    'OPEN','IN_PROGRESS','ON_HOLD','RESOLVED',
    'Active','On Hold','Resolved',
    'pending','resolved','rejected','in_progress',
    'Pending','Rejected'
  ));

-- Category from citizen incidents / department category
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'incidents_category_check'
  ) THEN
    ALTER TABLE incidents DROP CONSTRAINT incidents_category_check;
  END IF;
END $$;

ALTER TABLE incidents
  ADD CONSTRAINT incidents_category_check
  CHECK (category IS NULL OR category IN ('POWER','WATER','ROAD'));

-- FK for reported_by_user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'incidents_reported_by_fk'
  ) THEN
    ALTER TABLE incidents
      ADD CONSTRAINT incidents_reported_by_fk
      FOREIGN KEY (reported_by_user_id)
      REFERENCES users(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Self-FK for grouping/duplicate clustering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'incidents_grouped_fk'
  ) THEN
    ALTER TABLE incidents
      ADD CONSTRAINT incidents_grouped_fk
      FOREIGN KEY (grouped_incident_id)
      REFERENCES incidents(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS incidents_category_idx ON incidents(category);
CREATE INDEX IF NOT EXISTS incidents_reported_by_idx ON incidents(reported_by_user_id);

-- -----------------
-- incident_images (from incident-image.model.ts)
-- -----------------

CREATE TABLE IF NOT EXISTS incident_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  uploaded_by_user_id uuid NOT NULL,
  image_url text NOT NULL,
  is_geotagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT incident_images_incident_fk FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE RESTRICT,

  CONSTRAINT incident_images_uploaded_by_fk FOREIGN KEY (uploaded_by_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS incident_images_incident_created_idx ON incident_images(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS incident_images_uploaded_created_idx ON incident_images(uploaded_by_user_id, created_at DESC);

-- No silent deletion for immutable media logs
DROP TRIGGER IF EXISTS incident_images_no_update_delete ON incident_images;
CREATE TRIGGER incident_images_no_update_delete
BEFORE UPDATE OR DELETE ON incident_images
FOR EACH ROW
EXECUTE FUNCTION prevent_update_delete();

-- -----------------
-- incident_status_history (from incident-status-history.model.ts)
-- -----------------

ALTER TABLE incident_status_history ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE incident_status_history ADD COLUMN IF NOT EXISTS changed_by_user_id uuid;
ALTER TABLE incident_status_history ADD COLUMN IF NOT EXISTS remarks text;

-- Backward-compatible: keep to_status as the canonical; `status` mirrors it.
UPDATE incident_status_history
SET status = COALESCE(status, to_status)
WHERE status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'incident_status_history_changed_by_fk'
  ) THEN
    ALTER TABLE incident_status_history
      ADD CONSTRAINT incident_status_history_changed_by_fk
      FOREIGN KEY (changed_by_user_id)
      REFERENCES users(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Expand status check to cover both citizen + authority workflow
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'incident_status_history_to_status_check'
  ) THEN
    ALTER TABLE incident_status_history DROP CONSTRAINT incident_status_history_to_status_check;
  END IF;
END $$;

ALTER TABLE incident_status_history
  ADD CONSTRAINT incident_status_history_to_status_check
  CHECK (to_status IN ('OPEN','IN_PROGRESS','ON_HOLD','RESOLVED','Active','On Hold','Resolved'));

-- Append-only already enforced in 10_schema.sql

-- -----------------
-- audit_logs (from audit-log.model.ts)
-- -----------------

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS table_name text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS record_id uuid;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address inet;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent text;

-- Keep existing columns actor_user_id/action_type/etc for compatibility.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_logs_user_fk'
  ) THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_user_fk
      FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS audit_logs_user_created_idx ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_table_record_created_idx ON audit_logs(table_name, record_id, created_at DESC);

-- -----------------
-- Admin-side supporting tables (authority)
-- -----------------

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'Admin',
  department text NOT NULL DEFAULT 'All',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT admin_users_user_id_uniq UNIQUE (user_id),
  CONSTRAINT admin_users_role_check CHECK (role IN ('Admin','Auditor'))
);

CREATE INDEX IF NOT EXISTS admin_users_role_active_idx ON admin_users(role, active);

CREATE TABLE IF NOT EXISTS system_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS abuse_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text NOT NULL,
  citizen_id text NOT NULL,
  reason text NOT NULL,
  risk text NOT NULL,
  status text NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT abuse_cases_case_id_uniq UNIQUE (case_id),
  CONSTRAINT abuse_cases_reason_check CHECK (reason IN ('Spam','Manipulated media','Repeated low-confidence','Harassment')),
  CONSTRAINT abuse_cases_risk_check CHECK (risk IN ('Low','Medium','High')),
  CONSTRAINT abuse_cases_status_check CHECK (status IN ('Monitoring','Warned','Temporarily blocked'))
);

CREATE INDEX IF NOT EXISTS abuse_cases_citizen_idx ON abuse_cases(citizen_id);
CREATE INDEX IF NOT EXISTS abuse_cases_last_seen_idx ON abuse_cases(last_seen DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL DEFAULT 'admin-demo',
  type text NOT NULL,
  entity_type text NOT NULL DEFAULT 'incident',
  entity_id text NOT NULL,
  remark text NOT NULL,
  metadata jsonb,

  CONSTRAINT audit_events_type_check CHECK (type IN (
    'MODERATION_APPROVED',
    'MODERATION_REJECTED',
    'CITIZEN_FLAGGED',
    'USER_UPDATED',
    'ABUSE_ACTION',
    'CONFIG_UPDATED'
  ))
);

CREATE INDEX IF NOT EXISTS audit_events_ts_idx ON audit_events(ts DESC);
CREATE INDEX IF NOT EXISTS audit_events_type_idx ON audit_events(type);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events(entity_id);

-- Append-only for audit_events
DROP TRIGGER IF EXISTS audit_events_no_update_delete ON audit_events;
CREATE TRIGGER audit_events_no_update_delete
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW
EXECUTE FUNCTION prevent_update_delete();

COMMIT;
