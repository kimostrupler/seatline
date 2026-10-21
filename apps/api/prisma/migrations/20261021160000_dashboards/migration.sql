-- CreateTable
CREATE TABLE "dashboard_layouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "person_id" UUID,
    "widgets" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_layouts_tenant_id_person_id_key" ON "dashboard_layouts"("tenant_id", "person_id");

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_tenant_id_person_id_fkey" FOREIGN KEY ("tenant_id", "person_id") REFERENCES "people"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- One company default per workspace (NULLs aren't equal in the unique index above).
CREATE UNIQUE INDEX "dashboard_layouts_company_default" ON "dashboard_layouts"("tenant_id") WHERE "person_id" IS NULL;

-- Same tenant isolation as every other table.
ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_layouts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dashboard_layouts
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());

GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_layouts TO seatline_app;
