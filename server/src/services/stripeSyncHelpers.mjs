import { prisma } from "../db/client.mjs";
import { stripe } from "./stripeService.mjs";

/**
 * Current billing period as Unix seconds. Newer Stripe API shapes expose these on
 * `items.data[0]`; older payloads still use top-level `current_period_*`.
 */
export function subscriptionPeriodBoundsSec(stripeSub) {
  const item0 = stripeSub.items?.data?.[0];
  const start =
    item0?.current_period_start ??
    stripeSub.current_period_start ??
    item0?.currentPeriodStart ??
    stripeSub.currentPeriodStart;
  const end =
    item0?.current_period_end ??
    stripeSub.current_period_end ??
    item0?.currentPeriodEnd ??
    stripeSub.currentPeriodEnd;
  if (typeof start === "number" && typeof end === "number" && Number.isFinite(start) && Number.isFinite(end)) {
    return { startSec: start, endSec: end };
  }

  const anchor = stripeSub.billing_cycle_anchor ?? stripeSub.start_date;
  const price = item0?.price;
  const recurring = typeof price === "object" && price !== null ? price.recurring : null;
  if (typeof anchor === "number" && Number.isFinite(anchor) && recurring?.interval) {
    const n = recurring.interval_count ?? 1;
    return { startSec: anchor, endSec: estimatePeriodEndSec(anchor, recurring.interval, n) };
  }
  return null;
}

function estimatePeriodEndSec(startSec, interval, intervalCount) {
  const n = Math.max(1, intervalCount);
  switch (interval) {
    case "day":
      return startSec + n * 86400;
    case "week":
      return startSec + n * 7 * 86400;
    case "month":
      return startSec + n * 30 * 86400;
    case "year":
      return startSec + n * 365 * 86400;
    default:
      return startSec + 30 * 86400;
  }
}

/** `{ start, end }` for Prisma `currentPeriodStart` / `currentPeriodEnd`. */
export function subscriptionPeriodDates(stripeSub) {
  const b = subscriptionPeriodBoundsSec(stripeSub);
  if (!b) {
    throw new Error("stripe_subscription_missing_billing_period");
  }
  return { start: new Date(b.startSec * 1000), end: new Date(b.endSec * 1000) };
}

/** First subscription line item price id (string or expanded object). */
export function stripePriceIdFromSubscriptionObject(stripeSub) {
  const line0 = stripeSub.items?.data?.[0];
  if (!line0) return null;
  const p = line0.price;
  if (typeof p === "string") return p;
  if (p && typeof p === "object" && typeof p.id === "string") return p.id;
  return null;
}

/** Map first line item price id → local plan + billing cycle. */
export async function planAndCycleFromStripePriceId(priceId) {
  if (!priceId) return { plan: null, billingCycle: /** @type {"monthly" | "yearly"} */ ("monthly") };
  const plan = await prisma.plan.findFirst({
    where: {
      OR: [{ stripePriceMonthlyId: priceId }, { stripePriceYearlyId: priceId }],
    },
  });
  if (!plan) return { plan: null, billingCycle: "monthly" };
  const billingCycle = plan.stripePriceYearlyId === priceId ? "yearly" : "monthly";
  return { plan, billingCycle };
}

/**
 * Resolve local plan from a Stripe Price id when DB price columns are unset or out of date.
 * Tries: DB price ids → Stripe Price (product id, unit_amount, product name/code).
 */
export async function resolvePlanAndBillingCycle(priceId) {
  const direct = await planAndCycleFromStripePriceId(priceId);
  if (direct.plan) return direct;
  if (!priceId || !stripe) return { plan: null, billingCycle: /** @type {"monthly" | "yearly"} */ ("monthly") };

  let price;
  try {
    price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
  } catch {
    return { plan: null, billingCycle: "monthly" };
  }

  const productObj = price.product;
  const productId = typeof productObj === "string" ? productObj : productObj?.id;

  if (productId) {
    const byProduct = await prisma.plan.findFirst({
      where: { stripeProductId: productId, isActive: true, archivedAt: null },
    });
    if (byProduct) {
      const billingCycle = price.recurring?.interval === "year" ? "yearly" : "monthly";
      return { plan: byProduct, billingCycle };
    }
  }

  const u = price.unit_amount;
  const interval = price.recurring?.interval;
  if (u != null && (interval === "month" || interval === "year")) {
    const plans = await prisma.plan.findMany({ where: { isActive: true, archivedAt: null } });
    for (const p of plans) {
      if (interval === "month" && p.priceMonthlyCents === u) {
        return { plan: p, billingCycle: "monthly" };
      }
      if (interval === "year" && p.priceYearlyCents === u) {
        return { plan: p, billingCycle: "yearly" };
      }
    }
  }

  const productName =
    typeof productObj === "object" && productObj !== null && "name" in productObj && typeof productObj.name === "string"
      ? productObj.name
      : null;
  if (productName?.trim()) {
    const trimmed = productName.trim();
    const tokens = trimmed
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const codeCandidates = new Set([tokens.join(""), ...tokens]);
    for (const codeGuess of codeCandidates) {
      const byCode = await prisma.plan.findUnique({ where: { code: codeGuess } });
      if (byCode?.isActive && !byCode.archivedAt) {
        const billingCycle = price.recurring?.interval === "year" ? "yearly" : "monthly";
        return { plan: byCode, billingCycle };
      }
    }
    const byName = await prisma.plan.findFirst({
      where: {
        isActive: true,
        archivedAt: null,
        name: { equals: trimmed, mode: "insensitive" },
      },
    });
    if (byName) {
      const billingCycle = price.recurring?.interval === "year" ? "yearly" : "monthly";
      return { plan: byName, billingCycle };
    }
  }

  return { plan: null, billingCycle: "monthly" };
}

/** After a successful resolve via Stripe API, persist ids on Plan so future lookups hit the DB fast. */
export async function persistStripeIdsOnPlanIfMissing(planId, { priceId, billingCycle, productId }) {
  if (!priceId) return;
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return;
  const data = {};
  if (productId && !plan.stripeProductId) data.stripeProductId = productId;
  if (billingCycle === "monthly" && !plan.stripePriceMonthlyId) data.stripePriceMonthlyId = priceId;
  if (billingCycle === "yearly" && !plan.stripePriceYearlyId) data.stripePriceYearlyId = priceId;
  if (Object.keys(data).length === 0) return;
  await prisma.plan.update({ where: { id: planId }, data });
}

function mapStripeStatusValue(status) {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    case "paused":
      return "paused";
    default:
      return "past_due";
  }
}

/**
 * Map Stripe subscription state → local SubscriptionStatus.
 *
 * Important: Stripe's UI may show "Collection Paused" when `pause_collection` is set,
 * while the subscription `status` can still be "active". We treat `pause_collection`
 * as local `paused` so the self-serve Pause/Resume UI stays accurate.
 */
export function mapStripeStatus(stripeSubOrStatus) {
  if (stripeSubOrStatus && typeof stripeSubOrStatus === "object") {
    // `pause_collection` is null when collection is active, and an object when paused.
    if (stripeSubOrStatus.pause_collection != null) return "paused";
    return mapStripeStatusValue(stripeSubOrStatus.status);
  }
  return mapStripeStatusValue(stripeSubOrStatus);
}
