import { readCreditPackGrant } from "./subscriptionCredits.mjs";

export const EXTRA_EDIT_SINGLE_CODE = "addon_extra_edit_single";
export const EXTRA_EDIT_BUNDLE_CODE = "addon_extra_edit_bundle";

export function isPlanPricedExtraEditAddonCode(code) {
  return code === EXTRA_EDIT_SINGLE_CODE || code === EXTRA_EDIT_BUNDLE_CODE;
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

/**
 * Ceiling for rolled purchased website-edit credits (from plan `catalog_json`).
 * Seeded per tier so bundles like 5×$49 remain purchasable while still capping stock.
 */
export function readMaxPurchasedEditCreditsBalance(plan) {
  const j = planCatalogObj(plan);
  const n = j.maxPurchasedEditCreditsBalance ?? j.max_purchased_edit_credits_balance;
  if (typeof n === "number" && Number.isFinite(n) && n >= 0) return Math.floor(n);
  if (typeof n === "string" && n.trim() !== "") {
    const p = parseInt(n, 10);
    if (Number.isFinite(p) && p >= 0) return p;
  }
  const inc = Math.max(0, plan?.includedEditCreditsPerPeriod ?? 0);
  return Math.max(50, inc * 5);
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
