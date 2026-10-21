-- Safety rules Prisma's schema language can't express.
-- Every rule here is covered by a test in apps/api/test.

-- ============================================================================
-- 1. One open assignment per seat and per person (history rows have end_at set)
-- ============================================================================
CREATE UNIQUE INDEX seat_assignments_one_open_per_seat
  ON seat_assignments (seat_id) WHERE end_at IS NULL;
CREATE UNIQUE INDEX seat_assignments_one_open_per_person
  ON seat_assignments (person_id) WHERE end_at IS NULL AND person_id IS NOT NULL;

ALTER TABLE seat_assignments
  ADD CONSTRAINT seat_assignments_kind_check CHECK (
    (kind = 'assigned' AND person_id IS NOT NULL AND reserved_for IS NULL)
    OR (kind = 'reserved' AND person_id IS NULL AND reserved_for IS NOT NULL)
  ),
  ADD CONSTRAINT seat_assignments_period_check CHECK (end_at IS NULL OR end_at >= start_at);

-- ============================================================================
-- 2. History is append-only
-- ============================================================================
CREATE FUNCTION seat_assignments_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'seat history is append-only: assignments cannot be deleted'
      USING ERRCODE = 'restrict_violation';
  END IF;
  -- The only allowed update: closing an open assignment (end_at NULL -> timestamp).
  IF OLD.end_at IS NOT NULL THEN
    RAISE EXCEPTION 'seat history is append-only: closed assignment % cannot change', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.end_at IS NULL
     OR (NEW.id, NEW.tenant_id, NEW.seat_id, NEW.person_id, NEW.kind, NEW.reserved_for,
         NEW.start_at, NEW.assigned_by, NEW.note)
        IS DISTINCT FROM
        (OLD.id, OLD.tenant_id, OLD.seat_id, OLD.person_id, OLD.kind, OLD.reserved_for,
         OLD.start_at, OLD.assigned_by, OLD.note) THEN
    RAISE EXCEPTION 'seat history is append-only: only end_at may be set, once'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER seat_assignments_append_only
  BEFORE UPDATE OR DELETE ON seat_assignments
  FOR EACH ROW EXECUTE FUNCTION seat_assignments_guard();

CREATE FUNCTION audit_log_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_guard();

-- ============================================================================
-- 3. Row-Level Security: a transaction only sees rows of app.tenant_id
--    The API runs every request in a transaction that first does
--    SELECT set_config('app.tenant_id', '<uuid>', true). No setting = no rows.
-- ============================================================================
CREATE FUNCTION app_current_tenant() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants
  USING (id = app_current_tenant()) WITH CHECK (id = app_current_tenant());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['people', 'buildings', 'floors', 'rooms', 'seats',
                           'seat_assignments', 'audit_log']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = app_current_tenant())
         WITH CHECK (tenant_id = app_current_tenant())', t);
  END LOOP;
END $$;

-- ============================================================================
-- 4. The API's database role: least privilege, never the owner, never BYPASSRLS
--    (Local dev creates it with a password in infra/postgres/init.sql; on Azure,
--    give it a password once after the first deploy.)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'seatline_app') THEN
    CREATE ROLE seatline_app NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO seatline_app;
GRANT SELECT ON tenants TO seatline_app;
GRANT SELECT, INSERT, UPDATE ON people TO seatline_app;               -- people are deactivated, not deleted
GRANT SELECT, INSERT, UPDATE, DELETE ON buildings, floors, rooms, seats TO seatline_app;
GRANT SELECT, INSERT, UPDATE ON seat_assignments TO seatline_app;     -- trigger allows closing only
GRANT SELECT, INSERT ON audit_log TO seatline_app;
