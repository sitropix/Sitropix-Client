import {
  readExtraEditAddonOffer,
  readExtraEditTier,
  readPlanPricingMap,
} from "@/lib/addonPlanPricing";
import type { Plan, SubscriptionAddon } from "@/types/subscription";

export const EXTRA_EDIT_SINGLE_CODE = "addon_extra_edit_single";
export const EXTRA_EDIT_BUNDLE_CODE = "addon_extra_edit_bundle";
/** Legacy fixed-price pack — replaced by single/bundle add-ons with per-plan pricing. */
export const LEGACY_EXTRA_EDIT_PACK_CODE = "addon_extra_edit_credit_pack";

export function isOfficialExtraEditAddonCode(code: string): boolean {
  return code === EXTRA_EDIT_SINGLE_CODE || code === EXTRA_EDIT_BUNDLE_CODE;
}

/** @deprecated Use isOfficialExtraEditAddonCode */
export const isPlanPricedExtraEditAddonCode = isOfficialExtraEditAddonCode;

/** Extra-edit credit packs — use ExtraEditPurchaseModal, not generic add-on cards. */
export function isCreditPackAddon(addon: Pick<SubscriptionAddon, "code" | "catalogJson">): boolean {
  if (addon.code === LEGACY_EXTRA_EDIT_PACK_CODE) return true;
  if (isOfficialExtraEditAddonCode(addon.code)) return true;
  const j = addon.catalogJson ?? {};
  const effect = j.effectKind ?? j.effect_kind;
  return effect === "credit_pack";
}

export function isExtraEditAddonWithPlanPricing(
  addon: Pick<SubscriptionAddon, "code" | "catalogJson">,
): boolean {
  if (isOfficialExtraEditAddonCode(addon.code)) return true;
  const tier = readExtraEditTier(addon.catalogJson);
  return tier === "single" || tier === "bundle";
}

/** Resolve catalog rows used for extra-edit checkout. */
export function resolveExtraEditPurchaseAddons(
  catalog: SubscriptionAddon[],
  _plan?: Plan | null,
): {
  single: SubscriptionAddon | undefined;
  bundle: SubscriptionAddon | undefined;
} {
  const byCode = (code: string) => catalog.find((a) => a.code === code && a.isActive !== false);
  let single = byCode(EXTRA_EDIT_SINGLE_CODE);
  let bundle = byCode(EXTRA_EDIT_BUNDLE_CODE);
  const creditPacks = catalog.filter(
    (a) => isCreditPackAddon(a) && a.code !== LEGACY_EXTRA_EDIT_PACK_CODE && a.isActive !== false,
  );
  if (!single) {
    single = creditPacks.find((a) => readExtraEditTier(a.catalogJson) === "single");
  }
  if (!bundle) {
    bundle = creditPacks.find((a) => readExtraEditTier(a.catalogJson) === "bundle");
  }
  return { single, bundle };
}

/** Pricing for the extra-edit modal from add-on catalog (not plan catalog). */
export function readExtraEditPricingForPlan(
  plan: Plan | null | undefined,
  singleAddon: SubscriptionAddon | null | undefined,
  bundleAddon: SubscriptionAddon | null | undefined,
): { perEditCents: number; bundleCredits: number; bundleCents: number } {
  const singleOffer = singleAddon ? readExtraEditAddonOffer(singleAddon, plan) : { priceCents: 0, creditsGranted: 0 };
  const bundleOffer = bundleAddon ? readExtraEditAddonOffer(bundleAddon, plan) : { priceCents: 0, creditsGranted: 0 };
  return {
    perEditCents: singleOffer.priceCents,
    bundleCredits: bundleOffer.creditsGranted,
    bundleCents: bundleOffer.priceCents,
  };
}

/** True when active add-ons have pricing configured for this plan. */
export function canOfferExtraEditPurchases(
  plan: Plan | null | undefined,
  catalog?: SubscriptionAddon[],
): boolean {
  const { single, bundle } = resolveExtraEditPurchaseAddons(catalog ?? [], plan);
  const { perEditCents, bundleCredits, bundleCents } = readExtraEditPricingForPlan(
    plan,
    single,
    bundle,
  );
  return perEditCents > 0 || (bundleCredits > 0 && bundleCents > 0);
}

/** Extra edit / credit-pack add-ons may be purchased again (unlike one-time bolt-ons). */
export function isRepeatableExtraEditPurchase(
  addon: Pick<SubscriptionAddon, "code" | "catalogJson">,
): boolean {
  if (isOfficialExtraEditAddonCode(addon.code)) return true;
  return isCreditPackAddon(addon);
}

export { readPlanPricingMap };
