import type { Plan, SubscriptionAddon } from "@/types/subscription";

export const EXTRA_EDIT_SINGLE_CODE = "addon_extra_edit_single";
export const EXTRA_EDIT_BUNDLE_CODE = "addon_extra_edit_bundle";
/** Legacy fixed-price pack — replaced by plan-priced single/bundle add-ons. */
export const LEGACY_EXTRA_EDIT_PACK_CODE = "addon_extra_edit_credit_pack";

export function isPlanPricedExtraEditAddonCode(code: string): boolean {
  return code === EXTRA_EDIT_SINGLE_CODE || code === EXTRA_EDIT_BUNDLE_CODE;
}

/** Plan-priced edit credits — not shown as generic add-on cards (use ExtraEditPurchaseModal). */
export function isCreditPackAddon(addon: Pick<SubscriptionAddon, "code" | "catalogJson">): boolean {
  if (addon.code === LEGACY_EXTRA_EDIT_PACK_CODE) return true;
  if (isPlanPricedExtraEditAddonCode(addon.code)) return true;
  const j = addon.catalogJson ?? {};
  const effect = j.effectKind ?? j.effect_kind;
  return effect === "credit_pack";
}

function readExtraEditTier(addon: Pick<SubscriptionAddon, "catalogJson">): string | null {
  const j = addon.catalogJson ?? {};
  const t = j.extraEditTier ?? j.extra_edit_tier;
  return typeof t === "string" ? t : null;
}

const SYNTHETIC_SINGLE: SubscriptionAddon = {
  code: EXTRA_EDIT_SINGLE_CODE,
  label: "Extra website edit (single)",
  desc: "Adds 1 purchased edit credit at your plan's single-edit rate.",
  priceCents: 0,
  catalogJson: { effectKind: "credit_pack", extraEditTier: "single" },
};

const SYNTHETIC_BUNDLE: SubscriptionAddon = {
  code: EXTRA_EDIT_BUNDLE_CODE,
  label: "Extra website edit bundle",
  desc: "Adds a bundle of purchased edit credits at your plan's bundle rate.",
  priceCents: 0,
  catalogJson: { effectKind: "credit_pack", extraEditTier: "bundle" },
};

/** Resolve catalog rows used for extra-edit checkout (official codes, then tier fallbacks). */
export function resolveExtraEditPurchaseAddons(
  catalog: SubscriptionAddon[],
  plan?: Plan | null,
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
    single = creditPacks.find((a) => readExtraEditTier(a) === "single");
  }
  if (!bundle) {
    bundle = creditPacks.find((a) => readExtraEditTier(a) === "bundle");
  }

  const { perEditCents, bundleCredits, bundleCents } = readPlanExtraEditPricing(plan);
  if (!single && perEditCents > 0) single = SYNTHETIC_SINGLE;
  if (!bundle && bundleCredits > 0 && bundleCents > 0) bundle = SYNTHETIC_BUNDLE;

  return { single, bundle };
}

export function readPlanExtraEditPricing(plan: Plan | null | undefined) {
  const j = (plan?.catalogJson ?? {}) as Record<string, unknown>;
  const perEditCents =
    typeof j.extraEditSingleCents === "number"
      ? j.extraEditSingleCents
      : typeof j.extra_edit_single_cents === "number"
        ? j.extra_edit_single_cents
        : 0;
  const bundleCredits =
    typeof j.extraEditPackCount === "number"
      ? j.extraEditPackCount
      : typeof j.extra_edit_pack_count === "number"
        ? j.extra_edit_pack_count
        : 0;
  const bundleCents =
    typeof j.extraEditPackCents === "number"
      ? j.extraEditPackCents
      : typeof j.extra_edit_pack_cents === "number"
        ? j.extra_edit_pack_cents
        : 0;
  return { perEditCents, bundleCredits, bundleCents };
}

/** True when the project plan supports purchasing extra edits (plan catalog pricing). */
export function canOfferExtraEditPurchases(
  plan: Plan | null | undefined,
  _catalog?: SubscriptionAddon[],
): boolean {
  const { perEditCents, bundleCredits, bundleCents } = readPlanExtraEditPricing(plan);
  return perEditCents > 0 || (bundleCredits > 0 && bundleCents > 0);
}

/** Extra edit / credit-pack add-ons may be purchased again (unlike one-time bolt-ons). */
export function isRepeatableExtraEditPurchase(
  addon: Pick<SubscriptionAddon, "code" | "catalogJson">,
): boolean {
  if (isPlanPricedExtraEditAddonCode(addon.code)) return true;
  return isCreditPackAddon(addon);
}
