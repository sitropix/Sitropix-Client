-- Recurring add-ons on a different interval than the project plan use a dedicated Stripe subscription.
CREATE TABLE "project_recurring_addon_stripe" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "addon_code" TEXT NOT NULL,
    "stripe_subscription_id" TEXT NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_recurring_addon_stripe_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_recurring_addon_stripe_stripe_subscription_id_key" ON "project_recurring_addon_stripe"("stripe_subscription_id");

CREATE UNIQUE INDEX "project_recurring_addon_stripe_project_id_addon_code_key" ON "project_recurring_addon_stripe"("project_id", "addon_code");

CREATE INDEX "project_recurring_addon_stripe_project_id_idx" ON "project_recurring_addon_stripe"("project_id");

ALTER TABLE "project_recurring_addon_stripe" ADD CONSTRAINT "project_recurring_addon_stripe_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
