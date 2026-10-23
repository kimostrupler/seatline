-- Onboarding e-mails to a new workspace's admins on day 1, 3 and 7.
-- onboarding_sent: the last day sent (0 = none yet); workspaces that already exist are done.
ALTER TABLE "tenants" ADD COLUMN "onboarding_sent" SMALLINT NOT NULL DEFAULT 0;
UPDATE "tenants" SET "onboarding_sent" = 7;

-- Nightly: workspaces of the last 10 days still waiting for an onboarding e-mail (no demos).
CREATE FUNCTION list_onboarding_tenants() RETURNS TABLE (id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM tenants
  WHERE NOT is_demo AND onboarding_sent < 7 AND created_at > now() - interval '10 days'
$$;
REVOKE ALL ON FUNCTION list_onboarding_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_onboarding_tenants() TO seatline_app;
