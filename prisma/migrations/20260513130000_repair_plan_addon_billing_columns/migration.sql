-- Idempotent repair: some databases had billing-flag migrations marked applied without columns.
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "billing_monthly_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "billing_yearly_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "subscription_addons" ADD COLUMN IF NOT EXISTS "billing_monthly_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "subscription_addons" ADD COLUMN IF NOT EXISTS "billing_yearly_enabled" BOOLEAN NOT NULL DEFAULT true;
