import { readAddonEffectKind, readCreditPackGrant, totalCreditsAvailable } from "./subscriptionCredits.mjs";

export const EXTRA_EDIT_SINGLE_CODE = "addon_extra_edit_single";
export const EXTRA_EDIT_BUNDLE_CODE = "addon_extra_edit_bundle";

export function isPlanPricedExtraEditAddonCode(code) {
  return code === EXTRA_EDIT_SINGLE_CODE || code === EXTRA_EDIT_BUNDLE_CODE;
}

/** Extra edit / credit-pack add-ons may be purchased multiple times (capped by plan limits). */
export function isRepeatableExtraEditPurchase(addonRow) {
  if (!addonRow?.code) return false;
  if (isPlanPricedExtraEditAddonCode(addonRow.code)) return true;
  return readAddonEffectKind(addonRow.catalogJson) === "credit_pack";
}

export function addonEligibleForPlan(addonRow, plan) {
  const raw = addonRow?.eligiblePlanCodes;
  const arr = Array.isArray(raw)
    ? raw.filter((x) => typeof x === "string")
    : [];
  if (arr.length === 0) return true;
  if (!plan?.code) return false;
  return arr.includes(plan.code);
}

function planCatalogObj(plan) {
  return plan?.catalogJson && typeof plan.catalogJson === "object" ? plan.catalogJson : {};
}

function intNonNeg(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string" && value.trim() !== "") {
    const p = parseInt(value, 10);
    if (Number.isFinite(p) && p >= 0) return p;
  }
  return fallback;
}

/**
 * Ceiling for rolled purchased website-edit credits (from plan `catalog_json`).
 * Seeded per tier so bundles like 5×$49 remain purchasable while still capping stock.
 */
export function readMaxPurchasedEditCreditsBalance(plan) {
  const j = planCatalogObj(plan);
  const explicit = j.maxPurchasedEditCreditsBalance ?? j.max_purchased_edit_credits_balance;
  const fromCatalog = intNonNeg(explicit, -1);
  if (fromCatalog >= 0) return fromCatalog;

  const packCount = intNonNeg(j.extraEditPackCount ?? j.extra_edit_pack_count);
  if (packCount > 0) return packCount;

  const inc = intNonNeg(plan?.includedEditCreditsPerPeriod);
  return Math.max(50, inc * 5);
}

/** Upper bound on concurrent website edit credits (included allowance + purchased pool cap). */
export function readPlanTotalWebsiteEditCreditsLimit(plan) {
  const inc = intNonNeg(plan?.includedEditCreditsPerPeriod);
  return inc + readMaxPurchasedEditCreditsBalance(plan);
}

export function readExtraEditSingleOffer(plan) {
  const j = planCatalogObj(plan);
  const cents = j.extraEditSingleCents ?? j.extra_edit_single_cents;
  const c = typeof cents === "number" ? cents : parseInt(String(cents ?? "0"), 10);
  return { credits: 1, priceCents: Math.max(0, Math.floor(c || 0)) };
}

export function readExtraEditBundleOffer(plan) {
  const j = planCatalogObj(plan);
  const countRaw = j.extraEditPackCount ?? j.extra_edit_pack_count;
  const centsRaw = j.extraEditPackCents ?? j.extra_edit_pack_cents;
  const count = typeof countRaw === "number" ? countRaw : parseInt(String(countRaw ?? "0"), 10);
  const cents = typeof centsRaw === "number" ? centsRaw : parseInt(String(centsRaw ?? "0"), 10);
  return { credits: Math.max(0, Math.floor(count || 0)), priceCents: Math.max(0, Math.floor(cents || 0)) };
}

export function resolveCreditPackGrantForAddon(plan, addonRow) {
  if (!addonRow?.code) return 0;
  if (addonRow.code === EXTRA_EDIT_SINGLE_CODE) return readExtraEditSingleOffer(plan).credits;
  if (addonRow.code === EXTRA_EDIT_BUNDLE_CODE) return readExtraEditBundleOffer(plan).credits;
  return readCreditPackGrant(addonRow.catalogJson);
}

export function resolveExtraEditAddonPriceCents(plan, addonRow) {
  if (addonRow.code === EXTRA_EDIT_SINGLE_CODE) return readExtraEditSingleOffer(plan).priceCents;
  if (addonRow.code === EXTRA_EDIT_BUNDLE_CODE) return readExtraEditBundleOffer(plan).priceCents;
  return addonRow.priceCents ?? 0;
}

export function validateExtraEditAddonAgainstPlan(plan, addonRow) {
  if (!isPlanPricedExtraEditAddonCode(addonRow.code)) return { ok: true };
  const single = readExtraEditSingleOffer(plan);
  const bundle = readExtraEditBundleOffer(plan);
  if (addonRow.code === EXTRA_EDIT_SINGLE_CODE && single.priceCents <= 0) {
    return {
      ok: false,
      error: "extra_edit_pricing_not_configured",
      message: "Plan is missing extra edit single pricing in catalog.",
    };
  }
  if (addonRow.code === EXTRA_EDIT_BUNDLE_CODE && (bundle.credits <= 0 || bundle.priceCents <= 0)) {
    return {
      ok: false,
      error: "extra_edit_pricing_not_configured",
      message: "Plan is missing extra edit bundle pricing in catalog.",
    };
  }
  return { ok: true };
}

export function assertCreditPurchaseUnderCap({ plan, subscriptionRow, purchasedDelta }) {
  if (purchasedDelta <= 0) return { ok: true };
  const cap = readMaxPurchasedEditCreditsBalance(plan);
  const current = Math.max(0, subscriptionRow?.purchasedCreditsBalance ?? 0);
  const next = current + purchasedDelta;
  if (next > cap) {
    return {
      ok: false,
      error: "purchased_credits_cap_exceeded",
      message: `Purchased edit credits cannot exceed ${cap} for your plan (you have ${current}; this purchase would add ${purchasedDelta}).`,
    };
  }
  return { ok: true };
}

/**
 * Enforces purchased-balance ceiling and plan-wide total (included remaining + purchased)
 * after the purchase.
 */
export function assertWebsiteEditPurchaseAllowed({ plan, subscriptionRow, purchasedDelta }) {
  if (purchasedDelta <= 0) return { ok: true };
  const purchasedOnly = assertCreditPurchaseUnderCap({ plan, subscriptionRow, purchasedDelta });
  if (!purchasedOnly.ok) return purchasedOnly;
  const subLike = {
    includedCreditsPerPeriod: subscriptionRow?.includedCreditsPerPeriod ?? 0,
    includedCreditsUsedThisPeriod: subscriptionRow?.includedCreditsUsedThisPeriod ?? 0,
    purchasedCreditsBalance: subscriptionRow?.purchasedCreditsBalance ?? 0,
  };
  const currentTotal = totalCreditsAvailable(subLike);
  const limit = readPlanTotalWebsiteEditCreditsLimit(plan);
  const nextTotal = currentTotal + purchasedDelta;
  if (nextTotal > limit) {
    return {
      ok: false,
      error: "website_edit_credits_plan_limit_exceeded",
      message: `You currently have ${currentTotal} website edit credits available. Adding ${purchasedDelta} would exceed your plan limit of ${limit} credits (included allowance plus purchased cap).`,
    };
  }
  return { ok: true };
}
