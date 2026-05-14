import { prisma } from "../db/client.mjs";

/** Included pool remaining (never negative). */
export function includedCreditsRemaining(sub) {
  const cap = Math.max(0, sub.includedCreditsPerPeriod ?? 0);
  const used = Math.max(0, sub.includedCreditsUsedThisPeriod ?? 0);
  return Math.max(0, cap - used);
}

/** Purchased pack balance (never negative). */
export function purchasedCreditsRemaining(sub) {
  return Math.max(0, sub.purchasedCreditsBalance ?? 0);
}

export function totalCreditsAvailable(sub) {
  return includedCreditsRemaining(sub) + purchasedCreditsRemaining(sub);
}

/**
 * Apply plan defaults to a subscription row (does not persist).
 */
export function creditSnapshotFromPlan(plan) {
  const n = Math.max(0, plan?.includedEditCreditsPerPeriod ?? 0);
  return {
    includedCreditsPerPeriod: n,
    includedCreditsUsedThisPeriod: 0,
    purchasedCreditsBalance: 0,
  };
}

/**
 * Consume credits: included pool first, then purchased. Returns split or null if insufficient.
 */
export function allocateCreditCharge(sub, cost) {
  const c = Math.max(0, Math.floor(cost));
  if (c === 0) return { fromIncluded: 0, fromPurchased: 0 };
  const incLeft = includedCreditsRemaining(sub);
  const purLeft = purchasedCreditsRemaining(sub);
  if (incLeft + purLeft < c) return null;
  const fromIncluded = Math.min(c, incLeft);
  const fromPurchased = c - fromIncluded;
  return { fromIncluded, fromPurchased };
}

export async function chargeSubscriptionCreditsTx(tx, subscriptionId, cost) {
  const sub = await tx.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new Error("subscription_not_found");
  const split = allocateCreditCharge(sub, cost);
  if (!split) return null;
  if (split.fromIncluded === 0 && split.fromPurchased === 0) return split;
  const nextUsed = (sub.includedCreditsUsedThisPeriod ?? 0) + split.fromIncluded;
  const nextPurchased = (sub.purchasedCreditsBalance ?? 0) - split.fromPurchased;
  if (nextPurchased < 0) return null;
  await tx.subscription.update({
    where: { id: subscriptionId },
    data: {
      includedCreditsUsedThisPeriod: nextUsed,
      purchasedCreditsBalance: nextPurchased,
    },
  });
  return split;
}

export async function refundSubscriptionCreditsTx(tx, subscriptionId, fromIncluded, fromPurchased) {
  const fi = Math.max(0, Math.floor(fromIncluded ?? 0));
  const fp = Math.max(0, Math.floor(fromPurchased ?? 0));
  if (fi === 0 && fp === 0) return;
  const sub = await tx.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) return;
  const nextUsed = Math.max(0, (sub.includedCreditsUsedThisPeriod ?? 0) - fi);
  const nextPurchased = Math.max(0, (sub.purchasedCreditsBalance ?? 0) + fp);
  await tx.subscription.update({
    where: { id: subscriptionId },
    data: {
      includedCreditsUsedThisPeriod: nextUsed,
      purchasedCreditsBalance: nextPurchased,
    },
  });
}

/**
 * When billing period anchor changes, reset included usage and refresh cap from plan.
 */
export async function refreshCreditsForNewPeriodTx(tx, subscriptionId, plan) {
  const cap = Math.max(0, plan?.includedEditCreditsPerPeriod ?? 0);
  await tx.subscription.update({
    where: { id: subscriptionId },
    data: {
      includedCreditsPerPeriod: cap,
      includedCreditsUsedThisPeriod: 0,
    },
  });
}

/**
 * Detect period rollover comparing previous and next period start (ms).
 */
export function didBillingPeriodAdvance(prevStart, nextStart) {
  if (!prevStart || !nextStart) return false;
  return prevStart.getTime() !== nextStart.getTime();
}

export function readAddonEffectKind(catalogJson) {
  const j = catalogJson && typeof catalogJson === "object" ? catalogJson : {};
  const k = j.effectKind ?? j.effect_kind;
  if (
    k === "credit_pack" ||
    k === "consumable_service" ||
    k === "per_ticket" ||
    k === "priority_boost" ||
    k === "none"
  )
    return k;
  return "none";
}

export function readCreditPackGrant(catalogJson) {
  const j = catalogJson && typeof catalogJson === "object" ? catalogJson : {};
  const n = j.creditsGranted ?? j.credits_granted;
  const num = typeof n === "number" ? n : parseInt(String(n ?? "0"), 10);
  return Math.max(0, Math.floor(num || 0));
}
