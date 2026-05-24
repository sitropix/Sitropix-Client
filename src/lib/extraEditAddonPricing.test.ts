import { describe, expect, it } from "vitest";
import { readExtraEditAddonOffer, readPlanPricingMap } from "./addonPlanPricing";
import type { Plan, SubscriptionAddon } from "@/types/subscription";

const growthPlan = {
  id: "p1",
  code: "sitropix_growth",
} as Plan;

const singleAddon = {
  code: "addon_extra_edit_single",
  priceCents: 1000,
  catalogJson: {
    effectKind: "credit_pack",
    extraEditTier: "single",
    planPricing: {
      sitropix_starter: { priceCents: 1200 },
      sitropix_growth: { priceCents: 1000 },
      sitropix_pro: { priceCents: 800 },
    },
  },
} as unknown as SubscriptionAddon;

const bundleAddon = {
  code: "addon_extra_edit_bundle",
  priceCents: 3900,
  catalogJson: {
    effectKind: "credit_pack",
    extraEditTier: "bundle",
    planPricing: {
      sitropix_growth: { priceCents: 3900, creditsGranted: 5 },
    },
  },
} as unknown as SubscriptionAddon;

describe("addonPlanPricing (extra edit)", () => {
  it("reads per-plan price from add-on catalog", () => {
    expect(readExtraEditAddonOffer(singleAddon, growthPlan)).toEqual({
      priceCents: 1000,
      creditsGranted: 1,
    });
    expect(readExtraEditAddonOffer(bundleAddon, growthPlan)).toEqual({
      priceCents: 3900,
      creditsGranted: 5,
    });
  });

  it("parses planPricing map", () => {
    expect(readPlanPricingMap(singleAddon.catalogJson)).toEqual({
      sitropix_starter: { priceCents: 1200 },
      sitropix_growth: { priceCents: 1000 },
      sitropix_pro: { priceCents: 800 },
    });
  });
});
