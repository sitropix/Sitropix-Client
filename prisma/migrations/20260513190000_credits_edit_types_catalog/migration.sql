-- Catalog, credits, and edit types for project-scoped subscriptions.

CREATE TYPE "AddonBillingKind" AS ENUM ('recurring', 'one_time', 'per_use');

CREATE TYPE "EditTypeCategory" AS ENUM ('atomic', 'multi_credit');

CREATE TABLE "edit_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "EditTypeCategory" NOT NULL,
    "credits_min" INTEGER NOT NULL,
    "credits_max" INTEGER NOT NULL,
    "default_charge_credits" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edit_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "edit_types_code_key" ON "edit_types"("code");
CREATE INDEX "edit_types_is_active_idx" ON "edit_types"("is_active");

ALTER TABLE "plans" ADD COLUMN "included_edit_credits_per_period" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN "catalog_json" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "subscription_addons" ADD COLUMN "billing_kind" "AddonBillingKind" NOT NULL DEFAULT 'recurring';
ALTER TABLE "subscription_addons" ADD COLUMN "price_min_cents" INTEGER;
ALTER TABLE "subscription_addons" ADD COLUMN "price_max_cents" INTEGER;
ALTER TABLE "subscription_addons" ADD COLUMN "setup_fee_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscription_addons" ADD COLUMN "delivery_mode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "subscription_addons" ADD COLUMN "eligible_plan_codes" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "subscription_addons" ADD COLUMN "catalog_json" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "subscriptions" ADD COLUMN "included_credits_per_period" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscriptions" ADD COLUMN "included_credits_used_this_period" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscriptions" ADD COLUMN "purchased_credits_balance" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "support_tickets" ADD COLUMN "edit_type_id" TEXT;
ALTER TABLE "support_tickets" ADD COLUMN "credits_charged" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "support_tickets" ADD COLUMN "credits_from_included" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "support_tickets" ADD COLUMN "credits_from_purchased" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "support_tickets" ADD COLUMN "work_completed" BOOLEAN;
ALTER TABLE "support_tickets" ADD COLUMN "credits_refunded" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_edit_type_id_fkey" FOREIGN KEY ("edit_type_id") REFERENCES "edit_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "project_addon_entitlements" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "subscription_addon_id" TEXT NOT NULL,
    "checkout_dedupe_key" TEXT,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_addon_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_addon_entitlements_checkout_dedupe_key_key" ON "project_addon_entitlements"("checkout_dedupe_key");

CREATE INDEX "project_addon_entitlements_project_id_idx" ON "project_addon_entitlements"("project_id");

ALTER TABLE "project_addon_entitlements" ADD CONSTRAINT "project_addon_entitlements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_addon_entitlements" ADD CONSTRAINT "project_addon_entitlements_subscription_addon_id_fkey" FOREIGN KEY ("subscription_addon_id") REFERENCES "subscription_addons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
