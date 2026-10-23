-- Support: the operator deletes one whole workspace (owner dashboard). SECURITY DEFINER like
-- purge_demo_tenants: it removes every row of that workspace, history included, which the app
-- role can't (append-only triggers allow it only while seatline.privacy is set in here).
-- The API checks that the caller is the operator and that the workspace has no subscription.
CREATE FUNCTION delete_tenant(t uuid) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = t) THEN
    RETURN false;
  END IF;
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
  DELETE FROM tenants WHERE id = t;
  PERFORM set_config('seatline.privacy', '', true);
  PERFORM set_config('app.tenant_id', '', true);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION delete_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_tenant(uuid) TO seatline_app;
