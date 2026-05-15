import { describe, expect, it } from "vitest";
import {
  intNonNeg,
  readMaxPurchasedEditCreditsBalanceFromPlan,
  readPlanTotalWebsiteEditCreditsLimit,
} from "./websiteEditCreditsLimit";
import type { Plan } from "@/types/subscription";

describe("websiteEditCreditsLimit", () => {
  it("intNonNeg coerces strings to numbers", () => {
    expect(intNonNeg("5")).toBe(5);
    expect(intNonNeg("5") + intNonNeg("5")).toBe(10);
  });

  it("Growth-style plan without maxPurchased uses pack count (5+5=10)", () => {
    const plan = {
      includedEditCreditsPerPeriod: 5,
      catalogJson: {
        extraEditPackCount: 5,
        extraEditSingleCents: 1000,
        extraEditPackCents: 3900,
      },
    } as unknown as Plan;
    expect(readMaxPurchasedEditCreditsBalanceFromPlan(plan)).toBe(5);
    expect(readPlanTotalWebsiteEditCreditsLimit(plan)).toBe(10);
  });

  it("does not stringify-add included and purchased caps", () => {
    const plan = {
      includedEditCreditsPerPeriod: "5",
      catalogJson: { extraEditPackCount: "5" },
    } as unknown as Plan;
    expect(readPlanTotalWebsiteEditCreditsLimit(plan)).toBe(10);
  });

  it("respects explicit maxPurchasedEditCreditsBalance from catalog", () => {
    const plan = {
      includedEditCreditsPerPeriod: 2,
      catalogJson: {
        maxPurchasedEditCreditsBalance: 24,
        extraEditPackCount: 5,
      },
    } as unknown as Plan;
    expect(readPlanTotalWebsiteEditCreditsLimit(plan)).toBe(26);
  });
});
