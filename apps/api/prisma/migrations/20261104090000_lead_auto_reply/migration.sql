-- The latest automatic answer to our outreach (out-of-office and the like): when and its subject.
-- Shown on the lead; it never counts as a reply.
ALTER TABLE "leads" ADD COLUMN "auto_reply_at" TIMESTAMPTZ(3);
ALTER TABLE "leads" ADD COLUMN "auto_reply_subject" TEXT;
