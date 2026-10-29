-- The operator sets up a lead's office before they sign up: the workspace is "being prepared"
-- (the operator is its only admin) until it's handed over to the lead's contact.
ALTER TABLE "tenants" ADD COLUMN "prepared_by_owner" BOOLEAN NOT NULL DEFAULT false;
-- on the lead (in the operator's own workspace): which workspace was prepared, and when it was
-- handed over
ALTER TABLE "leads" ADD COLUMN "workspace_id" UUID;
ALTER TABLE "leads" ADD COLUMN "handed_over_at" TIMESTAMPTZ(3);
