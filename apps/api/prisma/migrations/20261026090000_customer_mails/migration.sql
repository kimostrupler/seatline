-- E-mails to customers' people and admins.
-- notify_people: people get an e-mail when they get a new desk (on by default).
-- trial_reminded: the last trial reminder sent (days left: 7, then 1), so each goes out once.
ALTER TABLE "tenants"
  ADD COLUMN "notify_people" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "trial_reminded" SMALLINT;

-- Nightly: workspaces whose free trial ends within 8 days and that have no subscription yet.
CREATE FUNCTION list_trial_tenants() RETURNS TABLE (id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM tenants
  WHERE stripe_subscription_id IS NULL
    AND trial_ends_at > now() AND trial_ends_at <= now() + interval '8 days'
$$;
REVOKE ALL ON FUNCTION list_trial_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_trial_tenants() TO seatline_app;
