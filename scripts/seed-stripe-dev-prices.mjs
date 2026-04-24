/**
 * One-shot (dev/test): create Stripe Product + monthly/yearly Prices from DB plan amounts,
 * then save stripeProductId, stripePriceMonthlyId, stripePriceYearlyId on each Plan.
 * Requires STRIPE_SECRET_KEY in .env. Safe to re-run: only creates missing prices.
 */
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import dotenv from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env") });

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("Set STRIPE_SECRET_KEY in .env");
  process.exit(1);
}

const stripe = new Stripe(key);
const prisma = new PrismaClient();

const plans = await prisma.plan.findMany({ where: { archivedAt: null }, orderBy: { code: "asc" } });
for (const plan of plans) {
  const currency = (plan.currency || "USD").toLowerCase();
  let productId = plan.stripeProductId;

  if (!productId) {
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description || undefined,
      metadata: { planCode: plan.code, portal: "zohoportal" },
    });
    productId = product.id;
    console.log(`[${plan.code}] product ${productId}`);
  }

  let monthlyId = plan.stripePriceMonthlyId;
  let yearlyId = plan.stripePriceYearlyId;

  if (!monthlyId) {
    const pr = await stripe.prices.create({
      product: productId,
      unit_amount: plan.priceMonthlyCents,
      currency,
      recurring: { interval: "month" },
      metadata: { planCode: plan.code, cycle: "monthly" },
    });
    monthlyId = pr.id;
    console.log(`[${plan.code}] monthly price ${monthlyId} ($${(plan.priceMonthlyCents / 100).toFixed(2)}/${currency})`);
  }

  if (!yearlyId) {
    const pr = await stripe.prices.create({
      product: productId,
      unit_amount: plan.priceYearlyCents,
      currency,
      recurring: { interval: "year" },
      metadata: { planCode: plan.code, cycle: "yearly" },
    });
    yearlyId = pr.id;
    console.log(`[${plan.code}] yearly price ${yearlyId} ($${(plan.priceYearlyCents / 100).toFixed(2)}/${currency} yr)`);
  }

  await prisma.plan.update({
    where: { id: plan.id },
    data: {
      stripeProductId: productId,
      stripePriceMonthlyId: monthlyId,
      stripePriceYearlyId: yearlyId,
    },
  });
}

console.log("Done. Run: npm run stripe:check-plans");
await prisma.$disconnect();
