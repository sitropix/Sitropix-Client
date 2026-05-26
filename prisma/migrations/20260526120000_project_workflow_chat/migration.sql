-- Project workflow tracking + per-project chat
-- Additive only: every column is nullable or has a default; no drops, renames, or type changes.

-- New enum for operational workflow status (separate from billing subscription_status)
CREATE TYPE "ProjectWorkflowStatus" AS ENUM (
  'awaiting_brief',
  'awaiting_assets',
  'ready_to_start',
  'in_progress',
  'awaiting_customer_reply',
  'in_review',
  'revisions_requested',
  'approved',
  'live',
  'on_hold'
);

-- Extend projects table with workflow + designer assignment + per-project settings + share link
ALTER TABLE "projects"
  ADD COLUMN "workflow_status" "ProjectWorkflowStatus" NOT NULL DEFAULT 'awaiting_brief',
  ADD COLUMN "workflow_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "phase_progress_percent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "assigned_designer_id" TEXT,
  ADD COLUMN "last_customer_activity_at" TIMESTAMP(3),
  ADD COLUMN "last_designer_activity_at" TIMESTAMP(3),
  ADD COLUMN "designer_heartbeat_at" TIMESTAMP(3),
  ADD COLUMN "brand_voice_short" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "notify_on_designer_reply" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notify_on_phase_change" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "staging_url" TEXT,
  ADD COLUMN "live_url" TEXT,
  ADD COLUMN "approved_design_at" TIMESTAMP(3),
  ADD COLUMN "approved_launch_at" TIMESTAMP(3),
  ADD COLUMN "pending_checkout_session_id" TEXT,
  ADD COLUMN "pending_checkout_session_at" TIMESTAMP(3),
  ADD COLUMN "share_link_token" TEXT,
  ADD COLUMN "share_link_expires_at" TIMESTAMP(3),
  ADD COLUMN "share_link_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Indexes for the new columns we'll query frequently
CREATE INDEX "projects_workflow_status_idx" ON "projects"("workflow_status");
CREATE INDEX "projects_assigned_designer_id_idx" ON "projects"("assigned_designer_id");
CREATE UNIQUE INDEX "projects_share_link_token_key" ON "projects"("share_link_token");

-- Designer assignment FK (SET NULL on user deletion so projects don't cascade-delete)
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_assigned_designer_id_fkey"
  FOREIGN KEY ("assigned_designer_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Per-project chat (designer ↔ customer thread, one row per message)
CREATE TABLE "project_chat_messages" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "author_user_id" TEXT,
  "is_staff" BOOLEAN NOT NULL DEFAULT false,
  "body" TEXT NOT NULL,
  "read_by_customer_at" TIMESTAMP(3),
  "read_by_staff_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_chat_messages_project_id_created_at_idx"
  ON "project_chat_messages"("project_id", "created_at" DESC);

ALTER TABLE "project_chat_messages"
  ADD CONSTRAINT "project_chat_messages_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_chat_messages"
  ADD CONSTRAINT "project_chat_messages_author_user_id_fkey"
  FOREIGN KEY ("author_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
