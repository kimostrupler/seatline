-- Outreach (the operator's Leads page under /owner): possible customers and the e-mails written
-- to them. Kept in the operator's own workspace, so the usual tenant RLS protects them; only
-- owner-checked endpoints and the morning job use these tables.
CREATE TABLE "leads" (
  "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"         UUID NOT NULL,
  "company"           TEXT NOT NULL,
  "website"           TEXT,
  "address"           TEXT,
  "why_now"           TEXT,
  "source_url"        TEXT,
  "contact_name"      TEXT,
  "greeting"          TEXT,
  "contact_role"      TEXT,
  "channel"           TEXT NOT NULL DEFAULT 'email' CHECK ("channel" IN ('email', 'form', 'linkedin')),
  "contact_email"     TEXT,
  "linkedin_url"      TEXT,
  "language"          TEXT NOT NULL DEFAULT 'de' CHECK ("language" IN ('de', 'fr', 'en')),
  "status"            TEXT NOT NULL DEFAULT 'research' CHECK ("status" IN ('research', 'ready',
                        'sent', 'followed_up', 'replied', 'meeting', 'customer', 'no', 'no_answer')),
  "first_sent_at"     TIMESTAMPTZ(3),
  "follow_up_sent_at" TIMESTAMPTZ(3),
  "replied_at"        TIMESTAMPTZ(3),
  "notes"             TEXT,
  "created_at"        TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "leads_tenant_id_status_idx" ON "leads"("tenant_id", "status");
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "lead_messages" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"     UUID NOT NULL,
  "lead_id"       UUID NOT NULL,
  "kind"          TEXT NOT NULL CHECK ("kind" IN ('first', 'follow_up')),
  "subject"       TEXT NOT NULL,
  "body"          TEXT NOT NULL,
  "to_address"    TEXT NOT NULL,
  "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
  "sent_at"       TIMESTAMPTZ(3),
  "canceled_at"   TIMESTAMPTZ(3),
  "message_id"    TEXT NOT NULL,
  "created_at"    TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "lead_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lead_messages_tenant_id_scheduled_for_idx" ON "lead_messages"("tenant_id", "scheduled_for");
ALTER TABLE "lead_messages" ADD CONSTRAINT "lead_messages_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_messages" ADD CONSTRAINT "lead_messages_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leads
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO seatline_app;
ALTER TABLE lead_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON lead_messages
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON lead_messages TO seatline_app;

-- The morning job: the workspaces that have leads (in practice only the operator's).
CREATE FUNCTION list_outreach_tenants() RETURNS TABLE (id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT tenant_id FROM leads
$$;
REVOKE ALL ON FUNCTION list_outreach_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_outreach_tenants() TO seatline_app;

-- Deleting a workspace must include the new tables.
CREATE OR REPLACE FUNCTION delete_tenant(t uuid) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = t) THEN
    RETURN false;
  END IF;
  PERFORM set_config('app.tenant_id', t::text, true);
  PERFORM set_config('seatline.privacy', 'purge', true);
  DELETE FROM audit_log WHERE tenant_id = t;
  DELETE FROM lead_messages WHERE tenant_id = t;
  DELETE FROM leads WHERE tenant_id = t;
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

