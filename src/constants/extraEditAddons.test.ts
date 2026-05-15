import { describe, expect, it } from "vitest";
import {
  canOfferExtraEditPurchases,
  isRepeatableExtraEditPurchase,
  resolveExtraEditPurchaseAddons,
  EXTRA_EDIT_BUNDLE_CODE,
  EXTRA_EDIT_SINGLE_CODE,
} from "./extraEditAddons";
import type { Plan, SubscriptionAddon } from "@/types/subscription";

const growthPlan = {
  id: "p1",
  code: "sitropix_growth",
  catalogJson: {
    extraEditSingleCents: 1000,
    extraEditPackCents: 3900,
    extraEditPackCount: 5,
  },
} as unknown as Plan;

const legacyPack = {
  code: "addon_extra_edit_credit_pack",
  label: "Extra edit credit pack",
  desc: "",
  priceCents: 5400,
  catalogJson: { effectKind: "credit_pack", creditsGranted: 5 },
} as SubscriptionAddon;

describe("extraEditAddons", () => {
  it("offers purchases when plan has pricing even without catalog rows", () => {
    expect(canOfferExtraEditPurchases(growthPlan, [])).toBe(true);
  });

  it("resolves synthetic single/bundle from plan when catalog is empty", () => {
    const { single, bundle } = resolveExtraEditPurchaseAddons([], growthPlan);
    expect(single?.code).toBe(EXTRA_EDIT_SINGLE_CODE);
    expect(bundle?.code).toBe(EXTRA_EDIT_BUNDLE_CODE);
  });

  it("treats plan-priced extra edit add-ons as repeatable", () => {
    expect(
      isRepeatableExtraEditPurchase({
        code: EXTRA_EDIT_SINGLE_CODE,
        catalogJson: { effectKind: "credit_pack", extraEditTier: "single" },
      }),
    ).toBe(true);
    expect(isRepeatableExtraEditPurchase(legacyPack)).toBe(true);
    expect(
      isRepeatableExtraEditPurchase({
        code: "addon_priority",
        catalogJson: { effectKind: "priority_boost" },
      }),
    ).toBe(false);
  });

  it("does not use legacy credit pack as bundle fallback", () => {
    const { single, bundle } = resolveExtraEditPurchaseAddons([legacyPack], growthPlan);
    expect(single?.code).toBe(EXTRA_EDIT_SINGLE_CODE);
    expect(bundle?.code).toBe(EXTRA_EDIT_BUNDLE_CODE);
  });
});
