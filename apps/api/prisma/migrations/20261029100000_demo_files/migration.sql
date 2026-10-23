-- Nightly: the demo workspaces about to be purged, so their files (plan images) go too.
CREATE FUNCTION list_old_demo_tenants(older_than interval) RETURNS TABLE (id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM tenants WHERE is_demo AND created_at < now() - older_than
$$;
REVOKE ALL ON FUNCTION list_old_demo_tenants(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_old_demo_tenants(interval) TO seatline_app;
