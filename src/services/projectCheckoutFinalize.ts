import { activateProjectSubscription } from "@/services/projectsStore";
import { fetchCustomerPortal, syncFromStripe } from "@/services/subscriptionsApi";
import type { BillingCycle, SubscriptionAddon } from "@/types/subscription";

export const PROJECT_CHECKOUT_INTENT_KEY = "sitropix_project_checkout_intent_v1";

export type ProjectCheckoutIntent = {
  projectId: string;
  planId: string;
  billingCycle: BillingCycle;
  addons: string[];
  startedAt: number;
};

const finalizeByStartedAt = new Map<number, Promise<void>>();

/**
 * After Stripe redirects back to the app, reconcile Stripe → portal → project row.
 * Deduplicated by `intent.startedAt` so React Strict Mode / double effects cannot
 * double-activate (which would append duplicate synthetic invoices server-side).
 */
export function finalizeProjectCheckoutOnce(intent: ProjectCheckoutIntent): Promise<void> {
  const existing = finalizeByStartedAt.get(intent.startedAt);
  if (existing) return existing;
  const run = finalizeProjectCheckoutFromIntent(intent.projectId, intent).finally(() => {
    finalizeByStartedAt.delete(intent.startedAt);
  });
  finalizeByStartedAt.set(intent.startedAt, run);
  return run;
}

export async function finalizeProjectCheckoutFromIntent(
  projectId: string,
  intent: ProjectCheckoutIntent,
): Promise<void> {
  await syncFromStripe({ projectId });
  const portalPayload = await fetchCustomerPortal({ projectId });
  const stripeSub = portalPayload.subscription;
  const stripePeriodEnd = stripeSub?.currentPeriodEnd ?? null;
  const isPaidState = stripeSub?.status === "active" || stripeSub?.status === "trialing";
  if (!stripeSub || !isPaidState || !stripePeriodEnd) {
    throw new Error("Stripe payment not confirmed yet. Complete checkout and retry.");
  }
  const stripePlanId = String(stripeSub.planId ?? "").trim();
  const intentPlanId = String(intent.planId ?? "").trim();
  if (stripePlanId && intentPlanId && stripePlanId !== intentPlanId) {
    throw new Error("Stripe subscription plan mismatch. Please retry checkout with the selected plan.");
  }
  const addonByCode = new Map(
    (portalPayload.addons ?? ([] as SubscriptionAddon[])).map((addon) => [addon.code, addon]),
  );
  const planForAmount = portalPayload.plans.find((p) => p.id === intent.planId) ?? null;
  const intentAddonsTotal = (intent.addons ?? []).reduce((sum, code) => {
    const item = addonByCode.get(code);
    return sum + (item?.priceCents ?? 0);
  }, 0);
  const baseAmount =
    intent.billingCycle === "monthly"
      ? (planForAmount?.priceMonthlyCents ?? 0)
      : (planForAmount?.priceYearlyCents ?? 0);
  await activateProjectSubscription(projectId, {
    planId: intent.planId,
    planName: planForAmount?.name ?? "Plan",
    billingCycle: intent.billingCycle,
    amountCents: baseAmount + intentAddonsTotal,
    currency: planForAmount?.currency || "USD",
    planValidUntil: stripePeriodEnd,
    addons: intent.addons ?? [],
  });
  window.localStorage.removeItem(PROJECT_CHECKOUT_INTENT_KEY);
}
