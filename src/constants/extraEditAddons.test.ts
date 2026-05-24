import { describe, expect, it } from "vitest";
import {
  canOfferExtraEditPurchases,
  isRepeatableExtraEditPurchase,
  readExtraEditPricingForPlan,
  resolveExtraEditPurchaseAddons,
  EXTRA_EDIT_BUNDLE_CODE,
  EXTRA_EDIT_SINGLE_CODE,
} from "./extraEditAddons";
import type { Plan, SubscriptionAddon } from "@/types/subscription";

const growthPlan = {
  id: "p1",
  code: "sitropix_growth",
  catalogJson: {},
} as unknown as Plan;

const singleAddon = {
  code: EXTRA_EDIT_SINGLE_CODE,
  label: "Single",
  desc: "",
  priceCents: 1000,
  isActive: true,
  catalogJson: {
    effectKind: "credit_pack",
    extraEditTier: "single",
    planPricing: { sitropix_growth: { priceCents: 1000 } },
  },
} as SubscriptionAddon;

const bundleAddon = {
  code: EXTRA_EDIT_BUNDLE_CODE,
  label: "Bundle",
  desc: "",
  priceCents: 3900,
  isActive: true,
  catalogJson: {
    effectKind: "credit_pack",
    extraEditTier: "bundle",
    planPricing: { sitropix_growth: { priceCents: 3900, creditsGranted: 5 } },
  },
} as SubscriptionAddon;

const legacyPack = {
  code: "addon_extra_edit_credit_pack",
  label: "Extra edit credit pack",
  desc: "",
  priceCents: 5400,
  catalogJson: { effectKind: "credit_pack", creditsGranted: 5 },
} as SubscriptionAddon;

describe("extraEditAddons", () => {
  it("offers purchases when add-ons have pricing for the plan", () => {
    expect(canOfferExtraEditPurchases(growthPlan, [singleAddon, bundleAddon])).toBe(true);
    expect(canOfferExtraEditPurchases(growthPlan, [])).toBe(false);
  });

  it("resolves single/bundle rows from catalog only", () => {
    const { single, bundle } = resolveExtraEditPurchaseAddons(
      [singleAddon, bundleAddon],
      growthPlan,
    );
    expect(single?.code).toBe(EXTRA_EDIT_SINGLE_CODE);
    expect(bundle?.code).toBe(EXTRA_EDIT_BUNDLE_CODE);
  });

  it("reads pricing from add-ons for the plan", () => {
    expect(
      readExtraEditPricingForPlan(growthPlan, singleAddon, bundleAddon),
    ).toEqual({
      perEditCents: 1000,
      bundleCredits: 5,
      bundleCents: 3900,
    });
  });

  it("treats official extra edit add-ons as repeatable", () => {
    expect(isRepeatableExtraEditPurchase(singleAddon)).toBe(true);
    expect(isRepeatableExtraEditPurchase(legacyPack)).toBe(true);
    expect(
      isRepeatableExtraEditPurchase({
        code: "addon_priority",
        catalogJson: { effectKind: "priority_boost" },
      }),
    ).toBe(false);
  });

  it("does not use legacy credit pack as bundle fallback", () => {
    const { single, bundle } = resolveExtraEditPurchaseAddons([legacyPack, singleAddon, bundleAddon], growthPlan);
    expect(single?.code).toBe(EXTRA_EDIT_SINGLE_CODE);
    expect(bundle?.code).toBe(EXTRA_EDIT_BUNDLE_CODE);
  });
});
