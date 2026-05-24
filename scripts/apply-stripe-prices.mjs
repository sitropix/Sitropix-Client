/**
 * Pushes recurring Price IDs from .env into Plan rows (by `code`).
 * Create products/prices in Stripe Dashboard (Test), then set:
 *   STRIPE_PRICE_STARTER_MONTHLY, STRIPE_PRICE_STARTER_YEARLY
 *   STRIPE_PRICE_GROWTH_MONTHLY, STRIPE_PRICE_GROWTH_YEARLY
 * Run: node scripts/apply-stripe-prices.mjs
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env") });

const mapping = [
  { code: "starter", month: "STRIPE_PRICE_STARTER_MONTHLY", year: "STRIPE_PRICE_STARTER_YEARLY" },
  { code: "growth", month: "STRIPE_PRICE_GROWTH_MONTHLY", year: "STRIPE_PRICE_GROWTH_YEARLY" },
];

const prisma = new PrismaClient();
const stripe = process.env.STRIPE_SECRET_KEY?.trim() ? new Stripe(process.env.STRIPE_SECRET_KEY.trim()) : null;

let updated = 0;
for (const m of mapping) {
  const mid = process.env[m.month]?.trim();
  const yid = process.env[m.year]?.trim();
  if (!mid && !yid) continue;
  const plan = await prisma.plan.findUnique({ where: { code: m.code } });
  if (!plan) {
    console.warn(`No plan with code "${m.code}" — skip`);
    continue;
  }
  const data = {};
  if (mid) data.stripePriceMonthlyId = mid;
  if (yid) data.stripePriceYearlyId = yid;
  if (stripe) {
    const priceId = mid ?? yid;
    try {
      const p = await stripe.prices.retrieve(priceId);
      const prod = p.product;
      const productId = typeof prod === "string" ? prod : prod?.id;
      if (productId) data.stripeProductId = productId;
    } catch (e) {
      console.warn(`Could not load Stripe price ${priceId}:`, e?.message ?? e);
    }
  }
  await prisma.plan.update({ where: { id: plan.id }, data });
  console.log(`Updated plan "${m.code}":`, data);
  updated++;
}
if (updated === 0) {
  console.log("Nothing to do. Set STRIPE_PRICE_STARTER_* / STRIPE_PRICE_GROWTH_* in .env and run again.");
} else {
  console.log(`Done. ${updated} plan(s) updated.`);
}
await prisma.$disconnect();
