-- Optional link from a support ticket to a project (owner must match ticket user).
ALTER TABLE "support_tickets" ADD COLUMN "project_id" TEXT;

CREATE INDEX "support_tickets_project_id_idx" ON "support_tickets"("project_id");

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
