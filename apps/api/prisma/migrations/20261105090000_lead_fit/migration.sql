-- How promising a lead is: company size and tags (moving, growing, hybrid …); the fit score is
-- computed from them (leadScore in packages/shared), never stored.
ALTER TABLE "leads" ADD COLUMN "employees" INTEGER;
ALTER TABLE "leads" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';

-- one short thank-you after a "no" (asking what didn't fit), sent at most once
ALTER TABLE "lead_messages" DROP CONSTRAINT "lead_messages_kind_check";
ALTER TABLE "lead_messages" ADD CONSTRAINT "lead_messages_kind_check"
  CHECK ("kind" IN ('first', 'follow_up', 'ask_why'));
