import { describe, expect, it } from "vitest";
import { buildProrationBreakdown, clampToRange, planPriceForCycle } from "../src/services/billingProration.mjs";

const plan = (m: number, y: number) => ({ priceMonthlyCents: m, priceYearlyCents: y });

describe("billingProration", () => {
  it("planPriceForCycle picks monthly or yearly", () => {
    const p = plan(1000, 10000);
    expect(planPriceForCycle(p, "monthly")).toBe(1000);
    expect(planPriceForCycle(p, "yearly")).toBe(10000);
  });

  it("planPriceForCycle uses monthly list price for one-time-only plan", () => {
    const p = { priceMonthlyCents: 5000, priceYearlyCents: 999, billingMonthlyEnabled: false, billingYearlyEnabled: false };
    expect(planPriceForCycle(p, "yearly")).toBe(5000);
    expect(planPriceForCycle(p, "monthly")).toBe(5000);
  });

  it("clampToRange bounds value", () => {
    expect(clampToRange(5, 0, 10)).toBe(5);
    expect(clampToRange(-1, 0, 10)).toBe(0);
    expect(clampToRange(99, 0, 10)).toBe(10);
  });

  it("buildProrationBreakdown: mid-period upgrade uses ~half remaining credit", () => {
    const start = new Date("2025-01-01T00:00:00.000Z");
    const end = new Date("2025-02-01T00:00:00.000Z");
    const mid = new Date("2025-01-16T12:00:00.000Z");
    const current = plan(3000, 30000);
    const next = plan(5000, 50000);
    const r = buildProrationBreakdown({
      currentPlan: current,
      nextPlan: next,
      cycle: "monthly",
      currentPeriodStart: start,
      currentPeriodEnd: end,
      now: mid,
    });
    expect(r.oldPriceCents).toBe(3000);
    expect(r.newPriceCents).toBe(5000);
    expect(r.remainingRatio).toBeGreaterThan(0.45);
    expect(r.remainingRatio).toBeLessThan(0.55);
    expect(r.unusedCreditCents).toBeGreaterThan(1300);
    expect(r.unusedCreditCents).toBeLessThan(1700);
    expect(r.chargeNowCents).toBeGreaterThan(3300);
    expect(r.chargeNowCents).toBeLessThan(3700);
  });

  it("buildProrationBreakdown: downgrade yields credit carry-forward (no immediate charge)", () => {
    const start = new Date("2025-01-01T00:00:00.000Z");
    const end = new Date("2025-02-01T00:00:00.000Z");
    const early = new Date("2025-01-02T00:00:00.000Z");
    const current = plan(10000, 100000);
    const next = plan(1000, 10000);
    const r = buildProrationBreakdown({
      currentPlan: current,
      nextPlan: next,
      cycle: "monthly",
      currentPeriodStart: start,
      currentPeriodEnd: end,
      now: early,
    });
    expect(r.creditCarryForwardCents).toBeGreaterThan(0);
    expect(r.chargeNowCents).toBe(0);
  });
});
