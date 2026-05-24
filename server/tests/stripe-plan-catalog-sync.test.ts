import { describe, expect, it } from "vitest";
import {
  planPatchTriggersCatalogSync,
  stripePriceNeedsRotation,
  subscriptionItemMatchesPlan,
} from "../src/services/stripePlanCatalogSync.mjs";

describe("stripePlanCatalogSync", () => {
  it("planPatchTriggersCatalogSync detects price-related keys", () => {
    expect(planPatchTriggersCatalogSync({ priceMonthlyCents: 1000 })).toBe(true);
    expect(planPatchTriggersCatalogSync({ description: "x" })).toBe(false);
    expect(planPatchTriggersCatalogSync({ stripePriceMonthlyId: "price_1" })).toBe(true);
  });

  it("stripePriceNeedsRotation when amount or interval differs", () => {
    expect(
      stripePriceNeedsRotation(
        { active: true, unit_amount: 1000, recurring: { interval: "month" } },
        "monthly",
        1000,
      ),
    ).toBe(false);
    expect(
      stripePriceNeedsRotation(
        { active: true, unit_amount: 1200, recurring: { interval: "month" } },
        "monthly",
        1000,
      ),
    ).toBe(true);
    expect(
      stripePriceNeedsRotation(
        { active: true, unit_amount: 10000, recurring: { interval: "year" } },
        "monthly",
        1000,
      ),
    ).toBe(true);
    expect(stripePriceNeedsRotation(null, "monthly", 1000)).toBe(true);
  });

  it("subscriptionItemMatchesPlan by price id or product id", () => {
    const plan = { stripeProductId: "prod_abc" };
    const known = new Set(["price_old"]);
    expect(
      subscriptionItemMatchesPlan(plan, { price: { id: "price_old", product: "prod_abc" } }, known),
    ).toBe(true);
    expect(
      subscriptionItemMatchesPlan(plan, { price: { id: "price_new", product: "prod_abc" } }, new Set()),
    ).toBe(true);
    expect(
      subscriptionItemMatchesPlan(plan, { price: { id: "price_x", product: "prod_other" } }, new Set()),
    ).toBe(false);
  });
});
