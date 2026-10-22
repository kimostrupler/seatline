-- Demo workspaces: visitors try Seatline with sample data, no sign-up. Deleted after a day.
ALTER TABLE "tenants" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- How many demo workspaces exist (a cap against abuse; before the tenant is known).
CREATE FUNCTION count_demo_tenants() RETURNS bigint
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) FROM tenants WHERE is_demo
$$;

-- Nightly: delete demo workspaces older than `older_than`, with everything in them.
-- (The append-only guards let history go only while seatline.privacy = 'purge'.)
CREATE FUNCTION purge_demo_tenants(older_than interval) RETURNS integer
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

-- Trial reminders never go to demo workspaces.
CREATE OR REPLACE FUNCTION list_trial_tenants() RETURNS TABLE (id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM tenants
  WHERE stripe_subscription_id IS NULL AND NOT is_demo
    AND trial_ends_at > now() AND trial_ends_at <= now() + interval '8 days'
$$;

REVOKE ALL ON FUNCTION count_demo_tenants(), purge_demo_tenants(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION count_demo_tenants(), purge_demo_tenants(interval) TO seatline_app;
