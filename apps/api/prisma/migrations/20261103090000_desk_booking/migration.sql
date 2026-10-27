-- Desk booking: some desks are "shared" (no permanent person); people book them for a day.
ALTER TABLE "seats" ADD COLUMN "shared" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "desk_bookings" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"    UUID NOT NULL,
  "seat_id"      UUID NOT NULL,
  "person_id"    UUID NOT NULL,
  "day"          DATE NOT NULL,
  "booked_by"    UUID NOT NULL,
  "created_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "cancelled_at" TIMESTAMPTZ(3),
  "cancelled_by" UUID,
  CONSTRAINT "desk_bookings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "desk_bookings_tenant_id_day_idx" ON "desk_bookings"("tenant_id", "day");
-- one booking per desk per day, one desk per person per day (cancelled ones don't count)
CREATE UNIQUE INDEX "desk_bookings_one_per_seat_day" ON "desk_bookings"("seat_id", "day")
  WHERE "cancelled_at" IS NULL;
CREATE UNIQUE INDEX "desk_bookings_one_per_person_day" ON "desk_bookings"("person_id", "day")
  WHERE "cancelled_at" IS NULL;
ALTER TABLE "desk_bookings" ADD CONSTRAINT "desk_bookings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "desk_bookings" ADD CONSTRAINT "desk_bookings_seat_fkey"
  FOREIGN KEY ("tenant_id", "seat_id") REFERENCES "seats"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "desk_bookings" ADD CONSTRAINT "desk_bookings_person_fkey"
  FOREIGN KEY ("tenant_id", "person_id") REFERENCES "people"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE desk_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk_bookings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON desk_bookings
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
-- no DELETE: a booking is cancelled (kept), and only the privacy functions remove old ones
GRANT SELECT, INSERT, UPDATE ON desk_bookings TO seatline_app;

-- Retention: bookings older than the cut-off go with the rest of the history.
CREATE OR REPLACE FUNCTION purge_history(cutoff timestamptz)
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
  DELETE FROM desk_bookings WHERE tenant_id = t AND day < cutoff::date;
  DELETE FROM audit_log WHERE tenant_id = t AND created_at < cutoff;
  GET DIAGNOSTICS l = ROW_COUNT;
  PERFORM set_config('seatline.privacy', '', true);
  RETURN QUERY SELECT a, l;
END $$;

-- Deleting a workspace (support) and old demo workspaces must include the bookings.
CREATE OR REPLACE FUNCTION delete_tenant(t uuid) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = t) THEN
    RETURN false;
  END IF;
  PERFORM set_config('app.tenant_id', t::text, true);
  PERFORM set_config('seatline.privacy', 'purge', true);
  DELETE FROM audit_log WHERE tenant_id = t;
  DELETE FROM lead_messages WHERE tenant_id = t;
  DELETE FROM leads WHERE tenant_id = t;
  DELETE FROM move_plan_items WHERE tenant_id = t;
  DELETE FROM move_plans WHERE tenant_id = t;
  DELETE FROM dashboard_layouts WHERE tenant_id = t;
  DELETE FROM team_plans WHERE tenant_id = t;
  DELETE FROM desk_bookings WHERE tenant_id = t;
  DELETE FROM seat_assignments WHERE tenant_id = t;
  DELETE FROM floor_markers WHERE tenant_id = t;
  DELETE FROM seats WHERE tenant_id = t;
  DELETE FROM rooms WHERE tenant_id = t;
  DELETE FROM floors WHERE tenant_id = t;
  DELETE FROM buildings WHERE tenant_id = t;
  DELETE FROM people WHERE tenant_id = t;
  DELETE FROM tenants WHERE id = t;
  PERFORM set_config('seatline.privacy', '', true);
  PERFORM set_config('app.tenant_id', '', true);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION purge_demo_tenants(older_than interval) RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t uuid;
  n integer := 0;
BEGIN
  FOR t IN SELECT id FROM tenants WHERE is_demo AND created_at < now() - older_than LOOP
    PERFORM set_config('app.tenant_id', t::text, true);
    PERFORM set_config('seatline.privacy', 'purge', true);
    DELETE FROM audit_log WHERE tenant_id = t;
    DELETE FROM move_plan_items WHERE tenant_id = t;
    DELETE FROM move_plans WHERE tenant_id = t;
    DELETE FROM dashboard_layouts WHERE tenant_id = t;
    DELETE FROM team_plans WHERE tenant_id = t;
    DELETE FROM desk_bookings WHERE tenant_id = t;
    DELETE FROM seat_assignments WHERE tenant_id = t;
    DELETE FROM floor_markers WHERE tenant_id = t;
    DELETE FROM seats WHERE tenant_id = t;
    DELETE FROM rooms WHERE tenant_id = t;
    DELETE FROM floors WHERE tenant_id = t;
    DELETE FROM buildings WHERE tenant_id = t;
    DELETE FROM people WHERE tenant_id = t;
    DELETE FROM tenants WHERE id = t AND is_demo;
    n := n + 1;
  END LOOP;
  PERFORM set_config('seatline.privacy', '', true);
  PERFORM set_config('app.tenant_id', '', true);
  RETURN n;
END $$;
