/**
 * Writes production Stripe product / price IDs onto Plan rows (by `code`).
 * Edit STRIPE_PLAN_IDS below when IDs change, then:
 *
 *   node scripts/db-push-stripe-plan-ids.mjs
 *
 * Requires plans seeded (`db:seed:catalog`). Missing stripeProductId rows fall back
 * to resolving the product from the monthly price when STRIPE_SECRET_KEY is set.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";

/** @type {{ code: string; stripeProductId?: string; stripePriceMonthlyId: string; stripePriceYearlyId: string }[]} */
const STRIPE_PLAN_IDS = [
  {
    code: "sitropix_starter",
    stripeProductId: "prod_UWNTHJAr1lxqGB",
    stripePriceMonthlyId: "price_1TXKiCJjROI1LR9ogv0jlbZE",
    stripePriceYearlyId: "price_1TXKiWJjROI1LR9o4t39Wod7",
  },
  {
    code: "sitropix_growth",
    stripeProductId: "prod_UWNWTVhUXpx1y4",
    stripePriceMonthlyId: "price_1TXKlKJjROI1LR9oEFW2Nw4l",
    stripePriceYearlyId: "price_1TXKlKJjROI1LR9ogdGzEFGr",
  },
  {
    code: "sitropix_pro",
    stripeProductId: "prod_UWNXzjNOFiZZRp",
    stripePriceMonthlyId: "price_1TXKmiJjROI1LR9ojURGVgkm",
    stripePriceYearlyId: "price_1TXKmiJjROI1LR9oJFmMkCwo",
  },
];

const prisma = new PrismaClient();
const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripe = stripeKey ? new Stripe(stripeKey) : null;

async function resolveProductId(productId, priceId) {
  if (productId?.trim()) return productId.trim();
  if (!stripe || !priceId?.trim()) return null;
  try {
    const price = await stripe.prices.retrieve(priceId.trim());
    const prod = price.product;
    return typeof prod === "string" ? prod : prod?.id ?? null;
  } catch (e) {
    console.warn(`  Could not resolve product from price ${priceId}:`, e?.message ?? e);
    return null;
  }
}

async function main() {
  let updated = 0;
  for (const row of STRIPE_PLAN_IDS) {
    const plan = await prisma.plan.findUnique({ where: { code: row.code } });
    if (!plan) {
      console.warn(`No plan with code "${row.code}" — skip`);
      continue;
    }

    const stripeProductId = await resolveProductId(
      row.stripeProductId,
      row.stripePriceMonthlyId,
    );

    const data = {
      stripePriceMonthlyId: row.stripePriceMonthlyId,
      stripePriceYearlyId: row.stripePriceYearlyId,
      ...(stripeProductId ? { stripeProductId } : {}),
    };

    await prisma.plan.update({ where: { id: plan.id }, data });
    console.log(`Updated "${row.code}" (${plan.name}):`, data);
    updated++;
  }

  if (updated === 0) {
    console.error("No plans updated. Run db:seed:catalog first or fix plan codes.");
    process.exit(1);
  }
  console.log(`Done. ${updated} plan(s) updated.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
