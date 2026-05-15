import { prisma } from "../db/client.mjs";
import { log } from "../observability/logger.mjs";
import { assertStripeConfigured, stripe } from "./stripeService.mjs";
import { stripePriceIdFromSubscriptionObject } from "./stripeSyncHelpers.mjs";
import { syncSubscriptionFromStripeForUserId } from "./stripeSubscriptionSync.mjs";

/** @typedef {"none" | "create_prorations" | "always_invoice"} ProrationBehavior */

const LIVE_SUB_STATUSES = ["active", "trialing", "past_due", "paused"];

/** In-flight sync per plan id (avoid duplicate admin/webhook storms). */
const syncInFlight = new Map();

/**
 * Whether an admin PATCH body should trigger catalog reconciliation.
 * @param {Record<string, unknown>} body
 */
export function planPatchTriggersCatalogSync(body) {
  const keys = [
    "priceMonthlyCents",
    "priceYearlyCents",
    "stripeProductId",
    "stripePriceMonthlyId",
    "stripePriceYearlyId",
  ];
  return keys.some((k) => Object.prototype.hasOwnProperty.call(body, k));
}

/**
 * True when stored Stripe price does not match plan cents for that cycle.
 * @param {{ unit_amount?: number | null; active?: boolean; recurring?: { interval?: string } | null } | null} price
 * @param {"monthly" | "yearly"} cycle
 * @param {number} amountCents
 */
export function stripePriceNeedsRotation(price, cycle, amountCents) {
  if (!price?.active) return true;
  if (price.unit_amount !== amountCents) return true;
  const want = cycle === "yearly" ? "year" : "month";
  if (price.recurring?.interval !== want) return true;
  return false;
}

/**
 * @param {import("@prisma/client").Plan} plan
 * @param {Set<string>} knownPriceIds
 */
export function subscriptionItemMatchesPlan(plan, item, knownPriceIds) {
  const price = item?.price;
  const priceId = typeof price === "string" ? price : price?.id;
  if (priceId && knownPriceIds.has(priceId)) return true;
  const productRef = typeof price === "object" && price ? price.product : null;
  const productId = typeof productRef === "string" ? productRef : productRef?.id;
  if (plan.stripeProductId && productId === plan.stripeProductId) return true;
  return false;
}

async function retrieveStripePrice(priceId) {
  if (!priceId || !stripe) return null;
  try {
    return await stripe.prices.retrieve(priceId);
  } catch {
    return null;
  }
}

async function ensureStripeProductForPlan(plan) {
  assertStripeConfigured();
  let productId = plan.stripeProductId?.trim() || null;
  if (productId) {
    try {
      const p = await stripe.products.retrieve(productId);
      if (p.active === false) {
        await stripe.products.update(productId, { active: true });
      }
    } catch {
      productId = null;
    }
  }
  if (!productId) {
    const created = await stripe.products.create({
      name: plan.name,
      description: plan.description ?? "",
      metadata: { code: plan.code, source: "catalog_sync" },
    });
    productId = created.id;
  }
  return productId;
}

/**
 * Create a new recurring price when cents/interval differ; optionally archive the previous price id.
 * @param {import("@prisma/client").Plan} plan
 * @param {string} productId
 * @param {"monthly" | "yearly"} cycle
 * @param {string | null | undefined} currentPriceId
 * @param {number} amountCents
 */
async function ensureCanonicalPriceForCycle(plan, productId, cycle, currentPriceId, amountCents) {
  const existing = currentPriceId ? await retrieveStripePrice(currentPriceId) : null;
  if (existing && !stripePriceNeedsRotation(existing, cycle, amountCents)) {
    return { priceId: currentPriceId, created: false, archivedPrevious: false };
  }

  const interval = cycle === "yearly" ? "year" : "month";
  const created = await stripe.prices.create({
    product: productId,
    unit_amount: amountCents,
    currency: (plan.currency ?? "USD").toLowerCase(),
    recurring: { interval },
    metadata: { code: plan.code, billingCycle: cycle, source: "catalog_sync" },
  });

  let archivedPrevious = false;
  if (currentPriceId && currentPriceId !== created.id) {
    try {
      await stripe.prices.update(currentPriceId, { active: false });
      archivedPrevious = true;
    } catch (e) {
      log.warn("catalog_sync.archive_old_price_failed", { priceId: currentPriceId, error: e?.message });
    }
  }

  return { priceId: created.id, created: true, archivedPrevious };
}

/**
 * Ensure Stripe product + monthly/yearly prices match DB cents; persist ids on Plan.
 * @param {string} planId
 */
export async function ensurePlanStripeCatalog(planId) {
  assertStripeConfigured();
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return { ok: false, reason: "plan_not_found" };

  const productId = await ensureStripeProductForPlan(plan);
  const monthly = await ensureCanonicalPriceForCycle(
    plan,
    productId,
    "monthly",
    plan.stripePriceMonthlyId,
    plan.priceMonthlyCents,
  );
  const yearly = await ensureCanonicalPriceForCycle(
    plan,
    productId,
    "yearly",
    plan.stripePriceYearlyId,
    plan.priceYearlyCents,
  );

  const data = {
    stripeProductId: productId,
    stripePriceMonthlyId: monthly.priceId,
    stripePriceYearlyId: yearly.priceId,
  };
  const changed =
    data.stripeProductId !== plan.stripeProductId ||
    data.stripePriceMonthlyId !== plan.stripePriceMonthlyId ||
    data.stripePriceYearlyId !== plan.stripePriceYearlyId;

  if (changed) {
    await prisma.plan.update({ where: { id: planId }, data });
  }

  return {
    ok: true,
    planId,
    productId,
    monthlyPriceId: monthly.priceId,
    yearlyPriceId: yearly.priceId,
    pricesCreated: Boolean(monthly.created || yearly.created),
    catalogChanged: changed,
  };
}

/**
 * Move active Stripe subscriptions onto the plan's canonical price for their billing cycle.
 * @param {string} planId
 * @param {{ prorationBehavior?: ProrationBehavior }} [options]
 */
export async function migrateSubscriptionsToCanonicalPrices(planId, options = {}) {
  assertStripeConfigured();
  const prorationBehavior = options.prorationBehavior ?? "none";
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan?.stripePriceMonthlyId || !plan?.stripePriceYearlyId) {
    return { ok: false, reason: "plan_missing_stripe_prices" };
  }

  const knownPriceIds = new Set(
    [plan.stripePriceMonthlyId, plan.stripePriceYearlyId].filter(Boolean),
  );

  const rows = await prisma.subscription.findMany({
    where: {
      planId,
      status: { in: LIVE_SUB_STATUSES },
      stripeSubscriptionId: { not: null },
    },
    select: {
      id: true,
      userId: true,
      projectId: true,
      billingCycle: true,
      stripeSubscriptionId: true,
    },
  });

  const report = {
    ok: true,
    examined: rows.length,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const row of rows) {
    const stripeSubId = row.stripeSubscriptionId;
    if (!stripeSubId) continue;
    try {
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubId, { expand: ["items.data.price"] });
      const cycle = row.billingCycle === "yearly" ? "yearly" : "monthly";
      const targetPriceId = cycle === "yearly" ? plan.stripePriceYearlyId : plan.stripePriceMonthlyId;
      const item = stripeSub.items?.data?.find((li) => subscriptionItemMatchesPlan(plan, li, knownPriceIds));
      if (!item) {
        report.skipped += 1;
        continue;
      }
      const currentPriceId = stripePriceIdFromSubscriptionObject({ items: { data: [item] } });
      if (currentPriceId === targetPriceId) {
        report.skipped += 1;
        continue;
      }
      await stripe.subscriptions.update(stripeSubId, {
        items: [{ id: item.id, price: targetPriceId }],
        proration_behavior: prorationBehavior,
      });
      report.updated += 1;
      if (row.userId) {
        try {
          await syncSubscriptionFromStripeForUserId(row.userId, {
            projectId: row.projectId ?? undefined,
          });
        } catch (e) {
          log.warn("catalog_sync.db_reconcile_failed", {
            subscriptionId: row.id,
            userId: row.userId,
            error: e?.message,
          });
        }
      }
    } catch (e) {
      report.failed += 1;
      report.errors.push({ subscriptionId: row.id, stripeSubscriptionId: stripeSubId, error: e?.message });
      log.error("catalog_sync.subscription_migrate_failed", {
        planId,
        subscriptionId: row.id,
        stripeSubscriptionId: stripeSubId,
        error: e?.message,
      });
    }
  }

  return report;
}

/**
 * Full pipeline: ensure Stripe catalog for plan, then optionally migrate live subscriptions.
 * @param {string} planId
 * @param {{
 *   triggeredBy?: string;
 *   migrateSubscriptions?: boolean;
 *   prorationBehavior?: ProrationBehavior;
 * }} [options]
 */
export async function runPlanCatalogSync(planId, options = {}) {
  if (!stripe) {
    return { ok: false, reason: "stripe_not_configured" };
  }

  const triggeredBy = options.triggeredBy ?? "manual";
  const migrateSubscriptions = options.migrateSubscriptions !== false;

  log.info("catalog_sync.start", { planId, triggeredBy, migrateSubscriptions });

  const catalog = await ensurePlanStripeCatalog(planId);
  if (!catalog.ok) {
    log.warn("catalog_sync.catalog_failed", { planId, triggeredBy, reason: catalog.reason });
    return { ok: false, reason: catalog.reason, triggeredBy };
  }

  let migration = null;
  if (migrateSubscriptions) {
    migration = await migrateSubscriptionsToCanonicalPrices(planId, {
      prorationBehavior: options.prorationBehavior,
    });
  }

  log.info("catalog_sync.done", {
    planId,
    triggeredBy,
    catalogChanged: catalog.catalogChanged,
    pricesCreated: catalog.pricesCreated,
    migration,
  });

  return {
    ok: true,
    triggeredBy,
    catalog,
    migration,
  };
}

/**
 * Fire-and-forget catalog sync (deduped per plan id).
 * @param {string} planId
 * @param {Parameters<typeof runPlanCatalogSync>[1]} [options]
 */
export function schedulePlanCatalogSync(planId, options = {}) {
  if (!stripe || !planId) return;
  if (syncInFlight.has(planId)) return;
  syncInFlight.set(planId, true);
  setImmediate(async () => {
    try {
      await runPlanCatalogSync(planId, options);
    } catch (e) {
      log.error("catalog_sync.scheduled_failed", { planId, error: e?.message });
    } finally {
      syncInFlight.delete(planId);
    }
  });
}

/**
 * Resolve local plan from a Stripe Price webhook payload and schedule sync.
 * @param {{ id?: string; product?: string | { id?: string }; active?: boolean }} stripePrice
 */
export async function schedulePlanCatalogSyncFromStripePrice(stripePrice) {
  if (!stripe || !stripePrice?.id) return;
  const productId =
    typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product?.id ?? null;

  let plan = null;
  if (productId) {
    plan = await prisma.plan.findFirst({
      where: { stripeProductId: productId, archivedAt: null },
    });
  }
  if (!plan) {
    plan = await prisma.plan.findFirst({
      where: {
        OR: [{ stripePriceMonthlyId: stripePrice.id }, { stripePriceYearlyId: stripePrice.id }],
        archivedAt: null,
      },
    });
  }
  if (!plan) return;

  schedulePlanCatalogSync(plan.id, {
    triggeredBy: `stripe_price:${stripePrice.id}`,
    migrateSubscriptions: true,
    prorationBehavior: "none",
  });
}
