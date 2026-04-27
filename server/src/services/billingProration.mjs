/**
 * Time-weighted proration (seconds-based) for plan changes. Used by the subscription change-plan flow.
 * @param {{ priceMonthlyCents: number; priceYearlyCents: number }} plan
 * @param {string} cycle
 */
export function planPriceForCycle(plan, cycle) {
  return cycle === "yearly" ? plan.priceYearlyCents : plan.priceMonthlyCents;
}

export function clampToRange(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

/**
 * @param {{
 *  currentPlan: { priceMonthlyCents: number; priceYearlyCents: number };
 *  nextPlan: { priceMonthlyCents: number; priceYearlyCents: number };
 *  cycle: string;
 *  currentPeriodStart: Date | string;
 *  currentPeriodEnd: Date | string;
 *  now?: Date;
 * }} p
 */
export function buildProrationBreakdown(p) {
  const { currentPlan, nextPlan, cycle, currentPeriodStart, currentPeriodEnd, now = new Date() } = p;
  const oldPriceCents = planPriceForCycle(currentPlan, cycle);
  const newPriceCents = planPriceForCycle(nextPlan, cycle);
  const startMs = new Date(currentPeriodStart).getTime();
  const endMs = new Date(currentPeriodEnd).getTime();
  const nowMs = now.getTime();

  const totalMs = Math.max(1, endMs - startMs);
  const usedMs = clampToRange(nowMs - startMs, 0, totalMs);
  const remainingMs = Math.max(0, totalMs - usedMs);
  const usedRatio = usedMs / totalMs;
  const remainingRatio = remainingMs / totalMs;

  const unusedCreditCents = Math.round(oldPriceCents * remainingRatio);
  const rawChargeCents = newPriceCents - unusedCreditCents;
  const chargeNowCents = Math.max(0, rawChargeCents);
  const creditCarryForwardCents = rawChargeCents < 0 ? Math.abs(rawChargeCents) : 0;

  return {
    oldPriceCents,
    newPriceCents,
    unusedCreditCents,
    chargeNowCents,
    creditCarryForwardCents,
    usedRatio,
    remainingRatio,
  };
}
