import type { Plan, SubscriptionAddon } from "@/types/subscription";

/** Mirrors `addonEligibleForPlan` in `server/src/services/extraEditCredits.mjs`. */
export function addonEligibleForPlan(
  addon: Pick<SubscriptionAddon, "eligiblePlanCodes">,
  plan: Plan | null | undefined,
): boolean {
  const raw = addon.eligiblePlanCodes;
  const arr = Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  if (arr.length === 0) return true;
  if (!plan?.code) return false;
  return arr.includes(plan.code);
}

/** Plan used to gate add-on purchase when the user may be changing tier on the subscription page. */
export function planForAddonPurchaseGate(
  hasLiveProjectPlan: boolean,
  ownedPlanId: string | null | undefined,
  selectedPlan: Plan | null,
  plans: Plan[],
): Plan | null {
  if (!hasLiveProjectPlan) return selectedPlan;
  if (selectedPlan && ownedPlanId && selectedPlan.id !== ownedPlanId) return selectedPlan;
  return plans.find((p) => p.id === ownedPlanId) ?? selectedPlan;
}
