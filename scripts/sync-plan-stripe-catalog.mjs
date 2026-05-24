/**
 * Ensure Stripe product/prices match plan DB cents and migrate active subscriptions.
 *
 * Usage:
 *   node scripts/sync-plan-stripe-catalog.mjs <planId|planCode> [--prorate]
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { reloadStripeFromSystemConfig } from "../server/src/services/stripeService.mjs";
import { runPlanCatalogSync } from "../server/src/services/stripePlanCatalogSync.mjs";

const prisma = new PrismaClient();

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: node scripts/sync-plan-stripe-catalog.mjs <planId|planCode> [--prorate]");
    process.exit(1);
  }
  const prorate = process.argv.includes("--prorate");
  await reloadStripeFromSystemConfig();

  const plan =
    (await prisma.plan.findUnique({ where: { id: arg } })) ??
    (await prisma.plan.findUnique({ where: { code: arg } }));
  if (!plan) {
    console.error("Plan not found:", arg);
    process.exit(1);
  }

  const result = await runPlanCatalogSync(plan.id, {
    triggeredBy: "cli",
    migrateSubscriptions: true,
    prorationBehavior: prorate ? "create_prorations" : "none",
  });
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
