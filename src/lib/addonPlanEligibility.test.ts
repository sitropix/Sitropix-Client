import { describe, expect, it } from "vitest";
import { addonEligibleForPlan, planForAddonPurchaseGate } from "./addonPlanEligibility";
import type { Plan, SubscriptionAddon } from "@/types/subscription";

const growthPlan = { id: "p1", code: "sitropix_growth", name: "Growth" } as Plan;
const proPlan = { id: "p2", code: "sitropix_pro", name: "Pro" } as Plan;

const proOnlyAddon = {
  code: "addon_seo",
  eligiblePlanCodes: ["sitropix_pro"],
} as SubscriptionAddon;

describe("addonPlanEligibility", () => {
  it("allows add-ons with empty eligiblePlanCodes for any plan", () => {
    expect(addonEligibleForPlan({ eligiblePlanCodes: [] }, growthPlan)).toBe(true);
    expect(addonEligibleForPlan({}, growthPlan)).toBe(true);
  });

  it("requires plan code in eligiblePlanCodes when restricted", () => {
    expect(addonEligibleForPlan(proOnlyAddon, growthPlan)).toBe(false);
    expect(addonEligibleForPlan(proOnlyAddon, proPlan)).toBe(true);
  });

  it("planForAddonPurchaseGate uses selected plan when changing tier", () => {
    expect(
      planForAddonPurchaseGate(true, growthPlan.id, proPlan, [growthPlan, proPlan]),
    ).toBe(proPlan);
  });

  it("planForAddonPurchaseGate uses owned plan when tier unchanged", () => {
    expect(
      planForAddonPurchaseGate(true, growthPlan.id, growthPlan, [growthPlan, proPlan]),
    ).toBe(growthPlan);
  });
});
