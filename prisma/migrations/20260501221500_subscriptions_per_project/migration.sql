-- Allow multiple Subscription rows per user, one per project (legacy rows keep project_id NULL).

-- Drop the old user-level uniqueness so a user can have multiple subscriptions (one per project).
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_user_id_key";

-- Add nullable project_id column.
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "project_id" TEXT;

-- Composite uniqueness: at most one subscription per (user, project) pair.
-- NB: Postgres treats NULLs as distinct, so legacy rows (project_id NULL) coexist per user.
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_user_id_project_id_key"
  ON "subscriptions" ("user_id", "project_id");

-- Plain index on user_id for non-unique lookups (e.g. find a user's primary sub).
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx"
  ON "subscriptions" ("user_id");

-- FK to projects so a project's subscription is set NULL (not deleted) when the project is removed.
ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
