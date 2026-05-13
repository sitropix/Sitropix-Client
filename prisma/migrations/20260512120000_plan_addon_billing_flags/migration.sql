-- Plan and add-on billing cycle availability (admin-configurable).
ALTER TABLE "plans" ADD COLUMN "billing_monthly_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "plans" ADD COLUMN "billing_yearly_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "subscription_addons" ADD COLUMN "billing_monthly_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "subscription_addons" ADD COLUMN "billing_yearly_enabled" BOOLEAN NOT NULL DEFAULT true;
