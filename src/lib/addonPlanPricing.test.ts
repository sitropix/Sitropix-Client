import { describe, expect, it } from "vitest";
import { aggregatePlanPricingListBounds } from "./addonPlanPricing";

describe("aggregatePlanPricingListBounds", () => {
  it("uses lowest monthly and yearly across plan rows", () => {
    const bounds = aggregatePlanPricingListBounds({
      sitropix_starter: { monthlyCents: 2000, yearlyCents: 20000 },
      sitropix_growth: { monthlyCents: 1200, yearlyCents: 12000 },
    });
    expect(bounds.priceMinCents).toBe(1200);
    expect(bounds.priceMaxCents).toBe(12000);
  });
});
