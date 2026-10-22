-- Space planning: how many people each team expects (e.g. after hiring), by when.
CREATE TABLE "team_plans" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"  UUID NOT NULL,
  "team"       TEXT NOT NULL,
  "headcount"  INTEGER NOT NULL CHECK ("headcount" >= 0),
  "by_date"    DATE,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "team_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "team_plans_tenant_id_team_key" ON "team_plans"("tenant_id", "team");
ALTER TABLE "team_plans" ADD CONSTRAINT "team_plans_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE team_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON team_plans
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON team_plans TO seatline_app;

-- Deleting demo workspaces must include the new table.
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
