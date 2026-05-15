import { prisma } from "../db/client.mjs";
import { didBillingPeriodAdvance } from "./subscriptionCredits.mjs";
import {
  mapStripeStatus,
  resolvePlanAndBillingCycle,
  stripePriceIdFromSubscriptionObject,
  subscriptionPeriodDates,
} from "./stripeSyncHelpers.mjs";

/**
 * Build DB patch for an existing subscription row from a Stripe subscription object.
 * Re-resolves plan + billing cycle from the line-item price when possible.
 *
 * @param {object} stripeSub
 * @param {{
 *   id: string;
 *   planId: string;
 *   billingCycle: string;
 *   currentPeriodStart?: Date | null;
 *   stripeCustomerId?: string | null;
 * }} existing
 */
export async function buildExistingSubscriptionPatchFromStripe(stripeSub, existing) {
  const { start: periodStart, end: periodEnd } = subscriptionPeriodDates(stripeSub);
  const status = mapStripeStatus(stripeSub);
  const priceId = stripePriceIdFromSubscriptionObject(stripeSub);
  const resolved = priceId
    ? await resolvePlanAndBillingCycle(priceId)
    : { plan: null, billingCycle: /** @type {"monthly"|"yearly"} */ (existing.billingCycle === "yearly" ? "yearly" : "monthly") };

  const planForCredits =
    resolved.plan ?? (await prisma.plan.findUnique({ where: { id: existing.planId } }));
  const periodAdvanced = didBillingPeriodAdvance(existing.currentPeriodStart, periodStart);

  /** @type {Record<string, unknown>} */
  const patch = {
    status,
    pausedAt: status === "paused" ? new Date() : null,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
    stripeCustomerId:
      typeof stripeSub.customer === "string"
        ? stripeSub.customer
        : stripeSub.customer?.id ?? existing.stripeCustomerId ?? undefined,
  };

  if (resolved.plan) {
    patch.planId = resolved.plan.id;
    patch.billingCycle = resolved.billingCycle;
  }

  if (periodAdvanced && planForCredits) {
    patch.includedCreditsPerPeriod = Math.max(0, planForCredits.includedEditCreditsPerPeriod ?? 0);
    patch.includedCreditsUsedThisPeriod = 0;
    patch.supportPriorityBoostUntil = null;
  }

  return { patch, resolvedPlanId: resolved.plan?.id ?? null, priceId };
}
