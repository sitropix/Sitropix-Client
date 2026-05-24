import type { Plan } from "@/types/subscription";
import type { ProjectUsageSnapshot } from "@/types/project";

/** Parse catalog / API numeric fields without string concatenation (e.g. "5" + 5 → "55"). */
export function intNonNeg(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string" && value.trim() !== "") {
    const p = parseInt(value, 10);
    if (Number.isFinite(p) && p >= 0) return p;
  }
  return fallback;
}

function planCatalog(plan: Plan | null | undefined): Record<string, unknown> {
  return (plan?.catalogJson ?? {}) as Record<string, unknown>;
}

/** Mirrors `readMaxPurchasedEditCreditsBalance` in `server/src/services/extraEditCredits.mjs`. */
export function readMaxPurchasedEditCreditsBalanceFromPlan(plan: Plan | null | undefined): number {
  if (!plan) return 0;
  const j = planCatalog(plan);
  const explicit = j.maxPurchasedEditCreditsBalance ?? j.max_purchased_edit_credits_balance;
  const fromCatalog = intNonNeg(explicit, -1);
  if (fromCatalog >= 0) return fromCatalog;

  const packCount = intNonNeg(j.extraEditPackCount ?? j.extra_edit_pack_count);
  if (packCount > 0) return packCount;

  const inc = intNonNeg(plan.includedEditCreditsPerPeriod);
  return Math.max(50, inc * 5);
}

/** Maximum total website edit credits (included allowance + purchased pool cap). */
export function readPlanTotalWebsiteEditCreditsLimit(plan: Plan | null | undefined): number {
  if (!plan) return 0;
  const inc = intNonNeg(plan.includedEditCreditsPerPeriod);
  return inc + readMaxPurchasedEditCreditsBalanceFromPlan(plan);
}

export function totalWebsiteEditCreditsAvailable(usage: ProjectUsageSnapshot | null | undefined): number {
  if (!usage) return 0;
  const cap = intNonNeg(usage.includedCreditsPerPeriod);
  const used = intNonNeg(usage.includedCreditsUsedThisPeriod);
  const includedLeft = Math.max(0, cap - used);
  const purchased = intNonNeg(usage.purchasedCreditsBalance);
  return includedLeft + purchased;
}

export function maxPurchasableExtraEditCredits(
  usage: ProjectUsageSnapshot | null | undefined,
  plan: Plan | null | undefined,
): number {
  const limit = readPlanTotalWebsiteEditCreditsLimit(plan);
  const cur = totalWebsiteEditCreditsAvailable(usage);
  return Math.max(0, limit - cur);
}
