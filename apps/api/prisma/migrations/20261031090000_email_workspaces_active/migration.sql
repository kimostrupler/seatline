-- email_workspaces also says whether the person is still active there: someone who left a
-- company may sign up for their own workspace with the same address, and the chooser prefers
-- the workspaces they're still in.
DROP FUNCTION email_workspaces(text);
CREATE FUNCTION email_workspaces(p_email text)
  RETURNS TABLE (tenant_id uuid, name text, microsoft boolean, active boolean)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, t.entra_tenant_id IS NOT NULL, p.active
  FROM people p JOIN tenants t ON t.id = p.tenant_id
  WHERE lower(p.email) = lower(p_email) AND p.forgotten_at IS NULL
  ORDER BY t.created_at
$$;
REVOKE ALL ON FUNCTION email_workspaces(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION email_workspaces(text) TO seatline_app;
