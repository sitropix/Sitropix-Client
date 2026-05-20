-- Add-on utilization tracking and support ticket category / add-on linkage.

CREATE TYPE "SupportTicketCategory" AS ENUM ('general', 'edit', 'addon');
CREATE TYPE "AddonRecurringType" AS ENUM ('monthly', 'yearly', 'one_time');

ALTER TABLE "support_tickets" ADD COLUMN "category" "SupportTicketCategory" NOT NULL DEFAULT 'general';
ALTER TABLE "support_tickets" ADD COLUMN "subscription_addon_id" TEXT;

CREATE INDEX "support_tickets_subscription_addon_id_idx" ON "support_tickets"("subscription_addon_id");
CREATE INDEX "support_tickets_category_idx" ON "support_tickets"("category");

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_subscription_addon_id_fkey"
  FOREIGN KEY ("subscription_addon_id") REFERENCES "subscription_addons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "addon_utilization_tracking" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "subscription_addon_id" TEXT NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurring_type" "AddonRecurringType" NOT NULL,
    "has_setup_fee" BOOLEAN NOT NULL DEFAULT false,
    "is_bundled" BOOLEAN NOT NULL DEFAULT false,
    "current_cycle_start" TIMESTAMP(3) NOT NULL,
    "current_cycle_end" TIMESTAMP(3) NOT NULL,
    "is_utilized" BOOLEAN NOT NULL DEFAULT false,
    "last_utilized_at" TIMESTAMP(3),
    "active_support_ticket_id" TEXT,
    "utilization_history" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addon_utilization_tracking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "addon_utilization_tracking_active_support_ticket_id_key" ON "addon_utilization_tracking"("active_support_ticket_id");
CREATE UNIQUE INDEX "addon_utilization_tracking_user_id_project_id_subscription_addon_id_current_cycle_start_key" ON "addon_utilization_tracking"("user_id", "project_id", "subscription_addon_id", "current_cycle_start");
CREATE INDEX "addon_utilization_tracking_project_id_subscription_addon_id_idx" ON "addon_utilization_tracking"("project_id", "subscription_addon_id");
CREATE INDEX "addon_utilization_tracking_subscription_id_idx" ON "addon_utilization_tracking"("subscription_id");

ALTER TABLE "addon_utilization_tracking" ADD CONSTRAINT "addon_utilization_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "addon_utilization_tracking" ADD CONSTRAINT "addon_utilization_tracking_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "addon_utilization_tracking" ADD CONSTRAINT "addon_utilization_tracking_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "addon_utilization_tracking" ADD CONSTRAINT "addon_utilization_tracking_subscription_addon_id_fkey" FOREIGN KEY ("subscription_addon_id") REFERENCES "subscription_addons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "addon_utilization_tracking" ADD CONSTRAINT "addon_utilization_tracking_active_support_ticket_id_fkey" FOREIGN KEY ("active_support_ticket_id") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
