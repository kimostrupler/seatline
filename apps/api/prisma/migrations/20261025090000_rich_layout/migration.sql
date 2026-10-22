-- Richer layouts: meeting rooms (capacity, equipment), team zones, desk features, map markers.
ALTER TABLE "rooms"
  ADD COLUMN "capacity" INTEGER,
  ADD COLUMN "equipment" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "team" TEXT,
  ADD CONSTRAINT "rooms_capacity_check" CHECK ("capacity" IS NULL OR "capacity" BETWEEN 1 AND 500);

ALTER TABLE "seats" ADD COLUMN "features" TEXT[] NOT NULL DEFAULT '{}';

-- Kitchen, printer, exits… to find one's way on a floor.
CREATE TABLE "floor_markers" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"  UUID NOT NULL,
  "floor_id"   UUID NOT NULL,
  "kind"       TEXT NOT NULL,
  "x"          DOUBLE PRECISION NOT NULL,
  "y"          DOUBLE PRECISION NOT NULL,
  "label"      TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "floor_markers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "floor_markers_tenant_id_id_key" ON "floor_markers"("tenant_id", "id");
CREATE INDEX "floor_markers_tenant_id_floor_id_idx" ON "floor_markers"("tenant_id", "floor_id");
ALTER TABLE "floor_markers" ADD CONSTRAINT "floor_markers_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "floor_markers" ADD CONSTRAINT "floor_markers_tenant_id_floor_id_fkey"
  FOREIGN KEY ("tenant_id", "floor_id") REFERENCES "floors"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same tenant isolation as every other table.
ALTER TABLE floor_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_markers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON floor_markers
  USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON floor_markers TO seatline_app;
