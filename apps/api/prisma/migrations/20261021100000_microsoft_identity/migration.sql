-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "default_app_role" "app_role" DEFAULT 'viewer',
ADD COLUMN     "people_sync_status" JSONB,
ADD COLUMN     "people_synced_at" TIMESTAMPTZ(3);


-- ============================================================================
-- Microsoft sign-in: find a workspace by its Entra (Microsoft 365) tenant id.
-- Runs before we know which tenant the caller belongs to, so RLS would hide the row.
-- SECURITY DEFINER = runs as the owner, but it only ever returns one id.
-- ============================================================================
CREATE FUNCTION resolve_tenant(entra_tid uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM tenants WHERE entra_tenant_id = entra_tid
$$;

-- Nightly people sync: every workspace connected to Microsoft 365.
CREATE FUNCTION list_sync_tenants() RETURNS TABLE (id uuid, entra_tenant_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, entra_tenant_id FROM tenants WHERE entra_tenant_id IS NOT NULL ORDER BY created_at
$$;

REVOKE ALL ON FUNCTION resolve_tenant(uuid), list_sync_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_tenant(uuid), list_sync_tenants() TO seatline_app;

-- Onboarding creates workspaces; admins change settings; the sync records its status.
-- (RLS still applies: a new tenant row must match app.tenant_id.)
GRANT INSERT, UPDATE ON tenants TO seatline_app;

-- Background jobs (pg-boss) keep their tables in their own schema, owned by the API role.
CREATE SCHEMA IF NOT EXISTS pgboss AUTHORIZATION seatline_app;
