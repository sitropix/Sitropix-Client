-- Legacy rows used TicketStatus value `closed` (added to PG enum outside Prisma).
-- Prisma schema uses `resolved`; normalize so ticket list queries do not fail.
UPDATE "support_tickets"
SET "status" = 'resolved', "updated_at" = NOW()
WHERE "status" = 'closed';
