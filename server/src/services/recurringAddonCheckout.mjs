import { addonStripeRecurringInterval } from "./recurringAddonStripe.mjs";
import { resolveAddonPlanPriceCents } from "./addonPlanPricing.mjs";

/**
 * Stripe requires one billing interval per subscription. Same interval as the plan → attach as a
 * subscription item; otherwise create a dedicated add-on subscription.
 */
export function resolveRecurringAddonAttachStrategy(subscriptionBillingCycle, chosenCycle) {
  const sub = subscriptionBillingCycle === "yearly" ? "yearly" : "monthly";
  const chosen = chosenCycle === "yearly" ? "yearly" : "monthly";
  if (sub === chosen) return "same_subscription";
  return "separate_subscription";
}

/** Unix timestamp when the first prepaid period ends (trial on the Stripe add-on subscription). */
export function prepaidPeriodTrialEndUnix(chosenCycle) {
  const d = new Date();
  if (chosenCycle === "yearly") {
    d.setUTCFullYear(d.getUTCFullYear() + 1);
  } else {
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return Math.floor(d.getTime() / 1000);
}

/**
 * Which interval the customer chose for a recurring add-on at checkout.
 * Yearly subscriptions may pick monthly or yearly add-on billing; monthly subs use monthly only.
 */
export function resolveChosenAddonRecurringCycle(subscriptionBillingCycle, addonRow, requestedCycle) {
  const subCycle = subscriptionBillingCycle === "yearly" ? "yearly" : "monthly";
  const monthlyOk = addonRow.billingMonthlyEnabled !== false;
  const yearlyOk = addonRow.billingYearlyEnabled !== false;

  if (subCycle === "monthly") {
    return monthlyOk ? "monthly" : yearlyOk ? "yearly" : null;
  }

  const req = requestedCycle === "yearly" ? "yearly" : requestedCycle === "monthly" ? "monthly" : null;
  if (req === "monthly" && monthlyOk) return "monthly";
  if (req === "yearly" && yearlyOk) return "yearly";
  if (monthlyOk) return "monthly";
  if (yearlyOk) return "yearly";
  return null;
}

export function isRecurringAddonRow(row) {
  return row?.billingKind === "recurring";
}

/** Unix timestamp for Stripe billing_cycle_anchor (align with plan period start). */
export function subscriptionBillingAnchorUnix(localSub, stripeSubscription) {
  const fromStripe =
    typeof stripeSubscription?.billing_cycle_anchor === "number"
      ? stripeSubscription.billing_cycle_anchor
      : typeof stripeSubscription?.start_date === "number"
        ? stripeSubscription.start_date
        : null;
  if (fromStripe != null && fromStripe > 0) return fromStripe;

  const start = localSub?.currentPeriodStart;
  if (start instanceof Date && !Number.isNaN(start.getTime())) {
    return Math.floor(start.getTime() / 1000);
  }
  if (typeof start === "string" && start.trim()) {
    const t = Date.parse(start);
    if (Number.isFinite(t)) return Math.floor(t / 1000);
  }
  return Math.floor(Date.now() / 1000);
}

export function buildRecurringAttachEntry(addonRow, plan, chosenCycle, subscriptionBillingCycle) {
  const recurringAmountCents = resolveAddonPlanPriceCents(plan, addonRow, chosenCycle);
  const interval = addonStripeRecurringInterval(addonRow, chosenCycle);
  const attachStrategy = resolveRecurringAddonAttachStrategy(
    subscriptionBillingCycle,
    chosenCycle,
  );
  return {
    code: addonRow.code,
    recurringAmountCents,
    interval,
    chosenCycle,
    attachStrategy,
  };
}

/**
 * First checkout charge for a recurring add-on (setup + first period, or first period only).
 */
export function recurringAddonFirstCheckoutCents(addonRow, plan, chosenCycle) {
  const setup = Math.max(0, addonRow.setupFeeCents ?? 0);
  const recurring = resolveAddonPlanPriceCents(plan, addonRow, chosenCycle);
  if (setup > 0) return setup + recurring;
  return recurring;
}
