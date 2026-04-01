-- CityPulse OLTP schema (PostgreSQL)
-- Rules enforced here:
-- - UUID primary keys (no auto-increment ints)
-- - TIMESTAMPTZ for time
-- - JSONB for metadata/log payloads
-- - Strict FKs with ON DELETE RESTRICT
-- - Append-only audit/history tables enforced via triggers

BEGIN;

-- ----------
-- Utilities
-- ----------
CREATE OR REPLACE FUNCTION prevent_update_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Updates/deletes are not allowed on append-only table %', TG_TABLE_NAME;
END;
$$;

-- ---------------
-- Core entities
-- ---------------

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_uniq UNIQUE (email),
  CONSTRAINT users_external_id_uniq UNIQUE (external_id),
  CONSTRAINT users_role_check CHECK (role IN ('CITIZEN','WORKER','AUTHORITY','ADMIN','AUDITOR'))
);

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT departments_code_uniq UNIQUE (code)
);

-- -----------------
-- Incident domain
-- -----------------

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- External/public tracking code
  incident_code text NOT NULL,

  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL,

  department_id uuid NOT NULL,
  zone text NOT NULL,

  -- Optional reporter (citizen) reference
  created_by_user_id uuid,

  -- Geo
  latitude double precision,
  longitude double precision,
  location geography(Point, 4326),

  -- Duplicate detection / clustering
  duplicate_cluster_id uuid,

  -- Immutable-ish metadata captured at creation time (can be extended, but should not rewrite history)
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT incidents_incident_code_uniq UNIQUE (incident_code),
  CONSTRAINT incidents_severity_check CHECK (severity IN ('Low','Medium','High','Critical')),
  CONSTRAINT incidents_status_check CHECK (status IN ('Active','Resolved','On Hold')),

  CONSTRAINT incidents_department_fk FOREIGN KEY (department_id)
    REFERENCES departments(id)
    ON DELETE RESTRICT,

  CONSTRAINT incidents_created_by_fk FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS incidents_created_at_idx ON incidents(created_at);
CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents(status);
CREATE INDEX IF NOT EXISTS incidents_department_idx ON incidents(department_id);
CREATE INDEX IF NOT EXISTS incidents_zone_idx ON incidents(zone);
CREATE INDEX IF NOT EXISTS incidents_location_gist ON incidents USING GIST(location);

-- Keep incidents.location in sync with lat/lon when provided
CREATE OR REPLACE FUNCTION set_incident_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS incidents_set_location ON incidents;
CREATE TRIGGER incidents_set_location
BEFORE INSERT OR UPDATE OF latitude, longitude
ON incidents
FOR EACH ROW
EXECUTE FUNCTION set_incident_location();

-- Citizen reports (can be multiple per incident)
CREATE TABLE IF NOT EXISTS incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  reporter_user_id uuid,
  report_text text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT incident_reports_incident_fk FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE RESTRICT,

  CONSTRAINT incident_reports_reporter_fk FOREIGN KEY (reporter_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS incident_reports_incident_id_idx ON incident_reports(incident_id);
CREATE INDEX IF NOT EXISTS incident_reports_created_at_idx ON incident_reports(created_at);

-- Status history (append-only)
CREATE TABLE IF NOT EXISTS incident_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_by_user_id uuid,
  remark text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT incident_status_history_incident_fk FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE RESTRICT,

  CONSTRAINT incident_status_history_changed_by_fk FOREIGN KEY (changed_by_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT,

  CONSTRAINT incident_status_history_to_status_check CHECK (to_status IN ('Active','Resolved','On Hold')),
  CONSTRAINT incident_status_history_from_status_check CHECK (from_status IS NULL OR from_status IN ('Active','Resolved','On Hold'))
);

CREATE INDEX IF NOT EXISTS incident_status_history_incident_id_idx ON incident_status_history(incident_id);
CREATE INDEX IF NOT EXISTS incident_status_history_created_at_idx ON incident_status_history(created_at);

DROP TRIGGER IF EXISTS incident_status_history_no_update_delete ON incident_status_history;
CREATE TRIGGER incident_status_history_no_update_delete
BEFORE UPDATE OR DELETE ON incident_status_history
FOR EACH ROW
EXECUTE FUNCTION prevent_update_delete();

-- Assignments (modeled as history; a new row per assignment event)
CREATE TABLE IF NOT EXISTS incident_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  worker_user_id uuid NOT NULL,
  assigned_by_user_id uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz,
  note text,

  CONSTRAINT incident_assignments_incident_fk FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE RESTRICT,

  CONSTRAINT incident_assignments_worker_fk FOREIGN KEY (worker_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT,

  CONSTRAINT incident_assignments_assigned_by_fk FOREIGN KEY (assigned_by_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS incident_assignments_incident_id_idx ON incident_assignments(incident_id);
CREATE INDEX IF NOT EXISTS incident_assignments_assigned_at_idx ON incident_assignments(assigned_at);

-- At most one active assignment per incident
CREATE UNIQUE INDEX IF NOT EXISTS incident_assignments_one_active_per_incident
  ON incident_assignments(incident_id)
  WHERE unassigned_at IS NULL;

-- Worker updates (append-only)
CREATE TABLE IF NOT EXISTS worker_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL,
  worker_user_id uuid,
  update_text text NOT NULL,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT worker_updates_incident_fk FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE RESTRICT,

  CONSTRAINT worker_updates_worker_fk FOREIGN KEY (worker_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS worker_updates_incident_id_idx ON worker_updates(incident_id);
CREATE INDEX IF NOT EXISTS worker_updates_created_at_idx ON worker_updates(created_at);

DROP TRIGGER IF EXISTS worker_updates_no_update_delete ON worker_updates;
CREATE TRIGGER worker_updates_no_update_delete
BEFORE UPDATE OR DELETE ON worker_updates
FOR EACH ROW
EXECUTE FUNCTION prevent_update_delete();

-- Audit logs (append-only)
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  actor_user_id uuid,
  actor_role text NOT NULL,

  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,

  request_id text,
  ip inet,
  user_agent text,

  old_data jsonb,
  new_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT audit_logs_actor_fk FOREIGN KEY (actor_user_id)
    REFERENCES users(id)
    ON DELETE RESTRICT,

  CONSTRAINT audit_logs_actor_role_check CHECK (actor_role IN ('CITIZEN','WORKER','AUTHORITY','ADMIN','AUDITOR'))
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS audit_logs_action_type_idx ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);

DROP TRIGGER IF EXISTS audit_logs_no_update_delete ON audit_logs;
CREATE TRIGGER audit_logs_no_update_delete
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_update_delete();

COMMIT;
