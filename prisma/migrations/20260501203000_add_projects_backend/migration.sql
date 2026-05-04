CREATE TYPE "ProjectSubscriptionStatus" AS ENUM ('not_started', 'on_hold', 'active');

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "subscription_status" "ProjectSubscriptionStatus" NOT NULL DEFAULT 'not_started',
  "plan_id" TEXT,
  "plan_name" TEXT,
  "plan_valid_until" TIMESTAMP(3),
  "billing_cycle" "BillingCycle",
  "addons_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "invoices_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "projects_owner_user_id_created_at_idx" ON "projects"("owner_user_id", "created_at" DESC);
CREATE INDEX "projects_subscription_status_idx" ON "projects"("subscription_status");

ALTER TABLE "projects"
ADD CONSTRAINT "projects_owner_user_id_fkey"
FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
