-- AlterTable
ALTER TABLE "people" ADD COLUMN     "forgotten_at" TIMESTAMPTZ(3),
ADD COLUMN     "left_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "history_retention_months" INTEGER DEFAULT 24;


-- People who already left: best guess for when.
UPDATE people SET left_at = synced_at WHERE NOT active AND left_at IS NULL;

-- ============================================================================
-- Privacy (Swiss nDSG): the only ways history may ever be deleted or changed.
-- History stays append-only for the app: it has no DELETE right on these tables, and the
-- guards below only let rows go while a privacy function is running (they set
-- seatline.privacy, transaction-local). Both functions only act on the workspace of the
-- current transaction (app.tenant_id), like row-level security.
-- ============================================================================
CREATE OR REPLACE FUNCTION seat_assignments_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('seatline.privacy', true) = 'purge' THEN RETURN OLD; END IF;
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

CREATE OR REPLACE FUNCTION audit_log_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('seatline.privacy', true) = 'purge' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' AND current_setting('seatline.privacy', true) = 'forget' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = 'restrict_violation';
END $$;

-- Deletes ended seat history and activity entries older than `cutoff` in this workspace.
CREATE FUNCTION purge_history(cutoff timestamptz)
  RETURNS TABLE (assignments bigint, activity bigint)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t uuid := app_current_tenant();
  a bigint;
  l bigint;
BEGIN
  IF t IS NULL THEN RAISE EXCEPTION 'no workspace selected'; END IF;
  PERFORM set_config('seatline.privacy', 'purge', true);
  DELETE FROM seat_assignments WHERE tenant_id = t AND end_at IS NOT NULL AND end_at < cutoff;
  GET DIAGNOSTICS a = ROW_COUNT;
  DELETE FROM audit_log WHERE tenant_id = t AND created_at < cutoff;
  GET DIAGNOSTICS l = ROW_COUNT;
  PERFORM set_config('seatline.privacy', '', true);
  RETURN QUERY SELECT a, l;
END $$;

-- Removes a person's personal data (name, e-mail, department, job title) from their record
-- and from the activity log entries about them. Only for people who left. Their seat history
-- stays, linked to the unnamed record.
CREATE FUNCTION forget_person(person uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t uuid := app_current_tenant();
BEGIN
  IF t IS NULL THEN RAISE EXCEPTION 'no workspace selected'; END IF;
  IF NOT EXISTS (SELECT 1 FROM people WHERE id = person AND tenant_id = t AND NOT active) THEN
    RAISE EXCEPTION 'only people who left can be forgotten' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE people SET
    display_name = 'Former employee',
    email = 'forgotten-' || id || '@invalid',
    department = NULL,
    job_title = NULL,
    entra_object_id = NULL,
    app_role = NULL,
    forgotten_at = now()
  WHERE id = person AND tenant_id = t;
  PERFORM set_config('seatline.privacy', 'forget', true);
  UPDATE audit_log SET
    before = before - ARRAY['displayName', 'email', 'department', 'jobTitle'],
    after = after - ARRAY['displayName', 'email', 'department', 'jobTitle']
  WHERE tenant_id = t AND entity_type = 'person' AND entity_id = person
    AND jsonb_typeof(coalesce(after, '{}'::jsonb)) = 'object'
    AND jsonb_typeof(coalesce(before, '{}'::jsonb)) = 'object';
  PERFORM set_config('seatline.privacy', '', true);
END $$;

-- The nightly job: workspaces that limit how long history is kept.
CREATE FUNCTION list_retention_tenants() RETURNS TABLE (id uuid, months int)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, history_retention_months FROM tenants WHERE history_retention_months IS NOT NULL
$$;

REVOKE ALL ON FUNCTION purge_history(timestamptz), forget_person(uuid), list_retention_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_history(timestamptz), forget_person(uuid), list_retention_tenants() TO seatline_app;
