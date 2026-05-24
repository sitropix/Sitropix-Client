import { prisma } from "../db/client.mjs";
import { log } from "../observability/logger.mjs";

/** One-time-safe: map legacy `closed` rows to `resolved` so Prisma can read them. */
export async function normalizeLegacyClosedSupportTickets() {
  try {
    const updated = await prisma.$executeRaw`
      UPDATE "support_tickets"
      SET "status" = 'resolved'::"TicketStatus", "updated_at" = NOW()
      WHERE "status" = 'closed'::"TicketStatus"
    `;
    if (updated > 0) {
      log.info("support.tickets.normalized_closed_status", { updated });
    }
  } catch (e) {
    log.warn("support.tickets.normalize_closed_failed", { error: e?.message });
  }
}
