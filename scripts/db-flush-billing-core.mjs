/**
 * Deletes all rows from core billing / project tables (PostgreSQL via Prisma).
 * Run after backup: `node scripts/db-flush-billing-core.mjs`
 *
 * Order respects foreign keys.
 */
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  // No interactive `$transaction(async tx => …)` — Prisma Data Platform / pooled URLs
  // often return P2028 on long interactive transactions. Order still respects FKs.
  await prisma.ticketAttachment.deleteMany({});
  await prisma.ticketMessage.deleteMany({});
  await prisma.supportTicket.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.projectAddonEntitlement.deleteMany({});
  await prisma.project.deleteMany({});
  // await prisma.subscriptionAddon.deleteMany({});
  // await prisma.plan.deleteMany({});
  // await prisma.editType.deleteMany({});
  console.log(
    "Flushed: ticket_attachments, ticket_messages, support_tickets, payments, subscriptions, project_addon_entitlements, projects.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
