-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "billed_seats" INTEGER,
ADD COLUMN     "billing_period_end" TIMESTAMPTZ(3),
ADD COLUMN     "billing_status" TEXT,
ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "stripe_subscription_id" TEXT,
ADD COLUMN     "trial_ends_at" TIMESTAMPTZ(3) NOT NULL DEFAULT (now() + '30 days'::interval);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_stripe_customer_id_key" ON "tenants"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_stripe_subscription_id_key" ON "tenants"("stripe_subscription_id");


-- The nightly job: workspaces with a subscription (to keep the billed seat count up to date).
CREATE FUNCTION list_billed_tenants() RETURNS TABLE (id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM tenants WHERE stripe_subscription_id IS NOT NULL
$$;
REVOKE ALL ON FUNCTION list_billed_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_billed_tenants() TO seatline_app;
