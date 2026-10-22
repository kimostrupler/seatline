-- The operator's own dashboard (/owner, only for OWNER_EMAILS): one row per workspace across all
-- customers. SECURITY DEFINER because it reads every workspace; the API only calls it for the
-- operator. No seat history, no employees' names — counts and the admins' contact addresses.
CREATE FUNCTION owner_workspaces() RETURNS TABLE (
  id uuid,
  name text,
  created_at timestamptz,
  is_demo boolean,
  microsoft boolean,
  people bigint,
  seats bigint,
  seated bigint,
  billing_status text,
  trial_ends_at timestamptz,
  billed_seats integer,
  subscribed boolean,
  last_activity timestamptz,
  admin_emails text[]
)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, t.created_at, t.is_demo, t.entra_tenant_id IS NOT NULL,
    (SELECT count(*) FROM people p WHERE p.tenant_id = t.id AND p.active),
    (SELECT count(*) FROM seats s WHERE s.tenant_id = t.id AND s.status = 'active'),
    (SELECT count(*) FROM seat_assignments a
       WHERE a.tenant_id = t.id AND a.end_at IS NULL AND a.kind = 'assigned'),
    t.billing_status, t.trial_ends_at, t.billed_seats, t.stripe_subscription_id IS NOT NULL,
    (SELECT max(l.created_at) FROM audit_log l WHERE l.tenant_id = t.id),
    ARRAY(SELECT p.email FROM people p
          WHERE p.tenant_id = t.id AND p.app_role = 'admin' AND p.active
          ORDER BY p.email)
  FROM tenants t
  ORDER BY t.created_at DESC
$$;
REVOKE ALL ON FUNCTION owner_workspaces() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION owner_workspaces() TO seatline_app;
