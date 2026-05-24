import { readAddonEffectKind, readCreditPackGrant } from "./subscriptionCredits.mjs";
import {
  readExtraEditAddonOffer,
  resolveAddonPlanPriceCents,
} from "./addonPlanPricing.mjs";

export const EXTRA_EDIT_SINGLE_CODE = "addon_extra_edit_single";
export const EXTRA_EDIT_BUNDLE_CODE = "addon_extra_edit_bundle";

export function isOfficialExtraEditAddonCode(code) {
  return code === EXTRA_EDIT_SINGLE_CODE || code === EXTRA_EDIT_BUNDLE_CODE;
}

/** @deprecated Use isOfficialExtraEditAddonCode */
export const isPlanPricedExtraEditAddonCode = isOfficialExtraEditAddonCode;

export { readExtraEditAddonOffer };

function readExtraEditTier(addonRow) {
  const j =
    addonRow?.catalogJson && typeof addonRow.catalogJson === "object" ? addonRow.catalogJson : {};
  const t = j.extraEditTier ?? j.extra_edit_tier;
  if (t === "single" || t === "bundle") return t;
  if (addonRow?.code === EXTRA_EDIT_SINGLE_CODE) return "single";
  if (addonRow?.code === EXTRA_EDIT_BUNDLE_CODE) return "bundle";
  return null;
}

/** Extra edit / credit-pack add-ons may be purchased multiple times. */
export function isRepeatableExtraEditPurchase(addonRow) {
  if (!addonRow?.code) return false;
  if (isOfficialExtraEditAddonCode(addonRow.code)) return true;
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
 */
export function readMaxPurchasedEditCreditsBalance(plan) {
  const j = planCatalogObj(plan);
  const explicit = j.maxPurchasedEditCreditsBalance ?? j.max_purchased_edit_credits_balance;
  const fromCatalog = intNonNeg(explicit, -1);
  if (fromCatalog >= 0) return fromCatalog;

  const inc = intNonNeg(plan?.includedEditCreditsPerPeriod);
  return Math.max(50, inc * 5);
}

/** Upper bound on concurrent website edit credits (included allowance + purchased pool cap). */
export function readPlanTotalWebsiteEditCreditsLimit(plan) {
  const inc = intNonNeg(plan?.includedEditCreditsPerPeriod);
  return inc + readMaxPurchasedEditCreditsBalance(plan);
}

export function resolveCreditPackGrantForAddon(plan, addonRow) {
  if (!addonRow?.code) return 0;
  const tier = readExtraEditTier(addonRow);
  if (tier === "single" || tier === "bundle" || isOfficialExtraEditAddonCode(addonRow.code)) {
    return readExtraEditAddonOffer(plan, addonRow).creditsGranted;
  }
  return readCreditPackGrant(addonRow.catalogJson);
}

export function resolveExtraEditAddonPriceCents(plan, addonRow) {
  return resolveAddonPlanPriceCents(plan, addonRow, null);
}

export function validateExtraEditAddonAgainstPlan(plan, addonRow) {
  const tier = readExtraEditTier(addonRow);
  if (!tier && !isOfficialExtraEditAddonCode(addonRow?.code)) return { ok: true };

  const offer = readExtraEditAddonOffer(plan, addonRow);
  if (offer.priceCents <= 0) {
    return {
      ok: false,
      error: "extra_edit_pricing_not_configured",
      message: "Add-on is missing extra edit pricing for this plan.",
    };
  }
  if (tier === "bundle" && offer.creditsGranted <= 0) {
    return {
      ok: false,
      error: "extra_edit_pricing_not_configured",
      message: "Add-on bundle is missing credits for this plan.",
    };
  }
  return { ok: true };
}

/** Extra edit purchases are not capped by plan balance — any quantity is allowed. */
export function assertCreditPurchaseUnderCap() {
  return { ok: true };
}

/** Extra edit purchases are not capped by plan balance — any quantity is allowed. */
export function assertWebsiteEditPurchaseAllowed() {
  return { ok: true };
}
