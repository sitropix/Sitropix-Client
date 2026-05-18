import { readCreditPackGrant } from "./subscriptionCredits.mjs";
import { EXTRA_EDIT_BUNDLE_CODE, EXTRA_EDIT_SINGLE_CODE } from "./extraEditCredits.mjs";

function addonCatalogObj(addonRow) {
  return addonRow?.catalogJson && typeof addonRow.catalogJson === "object" ? addonRow.catalogJson : {};
}

function readExtraEditTier(addonRow) {
  const j = addonCatalogObj(addonRow);
  const t = j.extraEditTier ?? j.extra_edit_tier;
  if (t === "single" || t === "bundle") return t;
  if (addonRow?.code === EXTRA_EDIT_SINGLE_CODE) return "single";
  if (addonRow?.code === EXTRA_EDIT_BUNDLE_CODE) return "bundle";
  return null;
}

function parseCents(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.max(0, Math.floor(value));
    return n > 0 ? n : undefined;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = parseInt(value, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function readPlanPricingMap(catalogJson) {
  const j = catalogJson && typeof catalogJson === "object" ? catalogJson : {};
  const raw = j.planPricing ?? j.plan_pricing;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [code, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry;
    const priceCents = parseCents(e.priceCents ?? e.price_cents);
    const monthlyCents = parseCents(e.monthlyCents ?? e.monthly_cents);
    const yearlyCents = parseCents(e.yearlyCents ?? e.yearly_cents);
    const creditsGranted = parseCents(e.creditsGranted ?? e.credits_granted);
    if (!priceCents && !monthlyCents && !yearlyCents) continue;
    out[code] = {
      ...(priceCents != null ? { priceCents } : {}),
      ...(monthlyCents != null ? { monthlyCents } : {}),
      ...(yearlyCents != null ? { yearlyCents } : {}),
      ...(creditsGranted != null ? { creditsGranted } : {}),
    };
  }
  return out;
}

function readPlanPricingEntry(addonRow, planCode) {
  if (!planCode) return null;
  const entry = readPlanPricingMap(addonRow.catalogJson)[planCode];
  if (!entry) return null;
  return entry;
}

export function resolveAddonPlanPriceCents(plan, addonRow, billingCycle) {
  const tier = readExtraEditTier(addonRow);
  if (tier) {
    const offer = readExtraEditAddonOffer(plan, addonRow);
    return offer.priceCents;
  }

  const entry = readPlanPricingEntry(addonRow, plan?.code);
  if (entry) {
    if (billingCycle === "yearly" && entry.yearlyCents != null && entry.yearlyCents > 0) {
      return entry.yearlyCents;
    }
    if (entry.monthlyCents != null && entry.monthlyCents > 0) return entry.monthlyCents;
    if (entry.priceCents != null && entry.priceCents > 0) return entry.priceCents;
  }
  return addonRow?.priceCents ?? 0;
}

export function readExtraEditAddonOffer(plan, addonRow) {
  const tier = readExtraEditTier(addonRow);
  const mapped = readPlanPricingEntry(addonRow, plan?.code);

  if (mapped) {
    const priceCents = mapped.priceCents ?? mapped.monthlyCents ?? mapped.yearlyCents ?? 0;
    if (priceCents > 0) {
      const creditsGranted =
        tier === "bundle"
          ? Math.max(0, mapped.creditsGranted ?? readCreditPackGrant(addonRow.catalogJson))
          : 1;
      return { priceCents, creditsGranted };
    }
  }

  const basePrice = Math.max(0, addonRow?.priceCents ?? 0);
  if (tier === "single" && basePrice > 0) {
    return { priceCents: basePrice, creditsGranted: 1 };
  }
  if (tier === "bundle" && basePrice > 0) {
    const cg = readCreditPackGrant(addonRow.catalogJson);
    if (cg > 0) return { priceCents: basePrice, creditsGranted: cg };
  }

  return { priceCents: 0, creditsGranted: 0 };
}
