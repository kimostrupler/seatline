-- HR changes + e-mail notices.
-- A person can have a leaving date: the nightly job lets them go on that day (seat freed,
-- history kept). Workspaces choose who gets e-mail notices about changes, and in which language.
ALTER TABLE "people" ADD COLUMN "leaves_on" DATE;

ALTER TABLE "tenants"
  ADD COLUMN "notify_emails" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "notify_events" TEXT[] NOT NULL DEFAULT '{left,joined,team,moves}',
  ADD COLUMN "notify_language" TEXT NOT NULL DEFAULT 'de',
  ADD CONSTRAINT "tenants_notify_language_check" CHECK ("notify_language" IN ('en', 'de', 'fr'));

-- Nightly: workspaces with someone whose leaving date has come.
CREATE FUNCTION list_leaving_tenants(day date) RETURNS TABLE (id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT tenant_id FROM people WHERE active AND leaves_on IS NOT NULL AND leaves_on <= day
$$;
REVOKE ALL ON FUNCTION list_leaving_tenants(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_leaving_tenants(date) TO seatline_app;
