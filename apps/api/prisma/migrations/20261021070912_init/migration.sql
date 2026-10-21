-- CreateEnum
CREATE TYPE "app_role" AS ENUM ('admin', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "room_type" AS ENUM ('office', 'open_space', 'meeting', 'other');

-- CreateEnum
CREATE TYPE "seat_type" AS ENUM ('desk', 'office');

-- CreateEnum
CREATE TYPE "seat_status" AS ENUM ('active', 'blocked');

-- CreateEnum
CREATE TYPE "assignment_kind" AS ENUM ('assigned', 'reserved');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "entra_tenant_id" UUID,
    "data_region" TEXT NOT NULL DEFAULT 'switzerlandnorth',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "entra_object_id" UUID,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "department" TEXT,
    "job_title" TEXT,
    "app_role" "app_role",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "synced_at" TIMESTAMPTZ(3),

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "plan_file_key" TEXT,
    "plan_width" DOUBLE PRECISION,
    "plan_height" DOUBLE PRECISION,
    "scale" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "floor_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "room_type" NOT NULL DEFAULT 'office',
    "polygon" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "floor_id" UUID NOT NULL,
    "room_id" UUID,
    "label" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" "seat_type" NOT NULL DEFAULT 'desk',
    "status" "seat_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "seat_id" UUID NOT NULL,
    "person_id" UUID,
    "kind" "assignment_kind" NOT NULL,
    "reserved_for" TEXT,
    "start_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_at" TIMESTAMPTZ(3),
    "assigned_by" UUID NOT NULL,
    "note" TEXT,

    CONSTRAINT "seat_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_entra_tenant_id_key" ON "tenants"("entra_tenant_id");

-- CreateIndex
CREATE INDEX "people_tenant_id_display_name_idx" ON "people"("tenant_id", "display_name");

-- CreateIndex
CREATE UNIQUE INDEX "people_tenant_id_id_key" ON "people"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "people_tenant_id_entra_object_id_key" ON "people"("tenant_id", "entra_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "people_tenant_id_email_key" ON "people"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_tenant_id_id_key" ON "buildings"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "floors_tenant_id_building_id_idx" ON "floors"("tenant_id", "building_id");

-- CreateIndex
CREATE UNIQUE INDEX "floors_tenant_id_id_key" ON "floors"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "rooms_tenant_id_floor_id_idx" ON "rooms"("tenant_id", "floor_id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_tenant_id_id_key" ON "rooms"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_tenant_id_floor_id_id_key" ON "rooms"("tenant_id", "floor_id", "id");

-- CreateIndex
CREATE INDEX "seats_tenant_id_floor_id_idx" ON "seats"("tenant_id", "floor_id");

-- CreateIndex
CREATE UNIQUE INDEX "seats_tenant_id_id_key" ON "seats"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "seats_floor_id_label_key" ON "seats"("floor_id", "label");

-- CreateIndex
CREATE INDEX "seat_assignments_tenant_id_seat_id_start_at_idx" ON "seat_assignments"("tenant_id", "seat_id", "start_at");

-- CreateIndex
CREATE INDEX "seat_assignments_tenant_id_person_id_start_at_idx" ON "seat_assignments"("tenant_id", "person_id", "start_at");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_entity_type_entity_id_idx" ON "audit_log"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_created_at_idx" ON "audit_log"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_tenant_id_building_id_fkey" FOREIGN KEY ("tenant_id", "building_id") REFERENCES "buildings"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_tenant_id_floor_id_fkey" FOREIGN KEY ("tenant_id", "floor_id") REFERENCES "floors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_tenant_id_floor_id_fkey" FOREIGN KEY ("tenant_id", "floor_id") REFERENCES "floors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_tenant_id_floor_id_room_id_fkey" FOREIGN KEY ("tenant_id", "floor_id", "room_id") REFERENCES "rooms"("tenant_id", "floor_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_tenant_id_seat_id_fkey" FOREIGN KEY ("tenant_id", "seat_id") REFERENCES "seats"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_tenant_id_person_id_fkey" FOREIGN KEY ("tenant_id", "person_id") REFERENCES "people"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_tenant_id_assigned_by_fkey" FOREIGN KEY ("tenant_id", "assigned_by") REFERENCES "people"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

