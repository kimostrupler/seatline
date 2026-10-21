-- CreateEnum
CREATE TYPE "MovePlanStatus" AS ENUM ('draft', 'scheduled', 'applied', 'cancelled', 'failed');

-- CreateTable
CREATE TABLE "move_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "status" "MovePlanStatus" NOT NULL DEFAULT 'draft',
    "effective_date" DATE,
    "created_by" UUID NOT NULL,
    "scheduled_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMPTZ(3),
    "problems" JSONB,

    CONSTRAINT "move_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "move_plan_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "to_seat_id" UUID,

    CONSTRAINT "move_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "move_plans_tenant_id_status_effective_date_idx" ON "move_plans"("tenant_id", "status", "effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "move_plans_tenant_id_id_key" ON "move_plans"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "move_plan_items_plan_id_person_id_key" ON "move_plan_items"("plan_id", "person_id");

-- AddForeignKey
ALTER TABLE "move_plans" ADD CONSTRAINT "move_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "move_plans" ADD CONSTRAINT "move_plans_tenant_id_created_by_fkey" FOREIGN KEY ("tenant_id", "created_by") REFERENCES "people"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "move_plans" ADD CONSTRAINT "move_plans_tenant_id_scheduled_by_fkey" FOREIGN KEY ("tenant_id", "scheduled_by") REFERENCES "people"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "move_plan_items" ADD CONSTRAINT "move_plan_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "move_plan_items" ADD CONSTRAINT "move_plan_items_tenant_id_plan_id_fkey" FOREIGN KEY ("tenant_id", "plan_id") REFERENCES "move_plans"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "move_plan_items" ADD CONSTRAINT "move_plan_items_tenant_id_person_id_fkey" FOREIGN KEY ("tenant_id", "person_id") REFERENCES "people"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "move_plan_items" ADD CONSTRAINT "move_plan_items_tenant_id_to_seat_id_fkey" FOREIGN KEY ("tenant_id", "to_seat_id") REFERENCES "seats"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same tenant isolation as every other table.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['move_plans', 'move_plan_items']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = app_current_tenant())
         WITH CHECK (tenant_id = app_current_tenant())', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON move_plans TO seatline_app;          -- plans are cancelled, not deleted
GRANT SELECT, INSERT, UPDATE, DELETE ON move_plan_items TO seatline_app;

-- The nightly job: which workspaces have scheduled moves due by `day` (runs before a tenant
-- is chosen, so RLS would hide the rows; only returns ids).
CREATE FUNCTION list_due_move_tenants(day date) RETURNS TABLE (id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT tenant_id FROM move_plans WHERE status = 'scheduled' AND effective_date <= day
$$;
REVOKE ALL ON FUNCTION list_due_move_tenants(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_due_move_tenants(date) TO seatline_app;
