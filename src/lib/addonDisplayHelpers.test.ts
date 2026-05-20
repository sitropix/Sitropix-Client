import { describe, expect, it } from "vitest";
import {
  addonCatalogDisplayCents,
  addonCatalogDisplayDesc,
  addonCheckoutDisplayCents,
  addonPriceCycleSuffix,
} from "./addonDisplayHelpers";
import type { Plan, SubscriptionAddon } from "@/types/subscription";

const growthPlan = {
  id: "p-growth",
  code: "sitropix_growth",
  isActive: true,
} as Plan;

const proPlan = {
  id: "p-pro",
  code: "sitropix_pro",
  isActive: true,
} as Plan;

describe("addonDisplayHelpers", () => {
  it("uses plan pricing map for catalog display by billing cycle", () => {
    const addon = {
      code: "addon_analytics",
      label: "Analytics",
      desc: "Analytics dashboard",
      priceCents: 9900,
      priceMinCents: 9900,
      priceMaxCents: 14900,
      billingKind: "recurring",
      billingMonthlyEnabled: true,
      billingYearlyEnabled: true,
      catalogJson: {
        planPricing: {
          sitropix_growth: { monthlyCents: 9900, yearlyCents: 10900 },
          sitropix_pro: { monthlyCents: 14900, yearlyCents: 15900 },
        },
      },
    } as SubscriptionAddon;

    expect(addonCatalogDisplayCents(addon, "monthly", [growthPlan, proPlan])).toBe(9900);
    expect(addonCatalogDisplayCents(addon, "yearly", [growthPlan, proPlan])).toBe(10900);
  });

  it("ignores plans without planPricing rows when computing catalog min", () => {
    const addon = {
      code: "addon_booking_widget",
      label: "Booking widget",
      desc: "Automated.",
      priceCents: 1200,
      billingKind: "recurring",
      billingMonthlyEnabled: true,
      billingYearlyEnabled: true,
      eligiblePlanCodes: ["sitropix_starter", "sitropix_growth"],
      catalogJson: {
        planPricing: {
          sitropix_starter: { monthlyCents: 1200, yearlyCents: 12000 },
          sitropix_growth: { monthlyCents: 1200, yearlyCents: 12000 },
        },
      },
    } as SubscriptionAddon;

    expect(addonCatalogDisplayCents(addon, "yearly", [growthPlan, proPlan])).toBe(12000);
    expect(addonCatalogDisplayCents(addon, "monthly", [growthPlan, proPlan])).toBe(1200);
  });

  it("does not use monthly plan price when yearly is selected", () => {
    const addon = {
      code: "addon_booking_widget",
      label: "Booking widget",
      desc: "Automated.",
      priceCents: 1200,
      priceMinCents: 1200,
      priceMaxCents: 12000,
      billingKind: "recurring",
      billingMonthlyEnabled: true,
      billingYearlyEnabled: true,
      catalogJson: {
        planPricing: {
          sitropix_starter: { monthlyCents: 1200 },
        },
      },
    } as SubscriptionAddon;

    expect(addonCatalogDisplayCents(addon, "yearly", [growthPlan])).toBe(12000);
    expect(addonCatalogDisplayCents(addon, "monthly", [growthPlan])).toBe(1200);
  });

  it("falls back to price min/max when no plan map", () => {
    const addon = {
      code: "addon_test",
      label: "Test",
      desc: "Test add-on",
      priceCents: 5000,
      priceMinCents: 2500,
      priceMaxCents: 5000,
      billingKind: "recurring",
      billingMonthlyEnabled: true,
      billingYearlyEnabled: true,
    } as SubscriptionAddon;

    expect(addonCatalogDisplayCents(addon, "monthly", [])).toBe(2500);
    expect(addonCatalogDisplayCents(addon, "yearly", [])).toBe(5000);
  });

  it("includes setup fee in checkout display", () => {
    const addon = {
      code: "addon_ecommerce",
      label: "E-commerce",
      desc: "E-commerce features",
      priceCents: 4500,
      setupFeeCents: 29900,
      billingKind: "recurring",
      billingMonthlyEnabled: true,
      billingYearlyEnabled: true,
      catalogJson: {
        planPricing: {
          sitropix_growth: { monthlyCents: 4500, yearlyCents: 9000 },
        },
      },
    } as SubscriptionAddon;

    expect(addonCheckoutDisplayCents(addon, growthPlan, "monthly")).toBe(34400);
    expect(addonCheckoutDisplayCents(addon, growthPlan, "yearly")).toBe(38900);
  });

  it("formats setup + recurring description by billing cycle", () => {
    const addon = {
      code: "addon_ecommerce_bolt_on",
      label: "E-commerce",
      desc: "$299 setup + $45/mo recurring.",
      priceCents: 4500,
      setupFeeCents: 29900,
      priceMinCents: 4500,
      priceMaxCents: 45000,
      billingKind: "recurring",
      billingMonthlyEnabled: true,
      billingYearlyEnabled: true,
    } as SubscriptionAddon;

    expect(addonCatalogDisplayDesc(addon, "monthly", [])).toContain("/mo");
    expect(addonCatalogDisplayDesc(addon, "yearly", [])).toContain("/yr");
    expect(addonCatalogDisplayDesc(addon, "yearly", [])).not.toContain("/mo");
  });

  it("formats cycle suffix for recurring add-ons", () => {
    const recurring = {
      code: "addon_r",
      label: "Recurring",
      desc: "Recurring add-on",
      billingKind: "recurring",
      billingMonthlyEnabled: true,
      billingYearlyEnabled: true,
    } as SubscriptionAddon;
    const oneTime = {
      code: "addon_o",
      label: "One-time",
      desc: "One-time add-on",
      billingKind: "one_time",
      billingMonthlyEnabled: false,
      billingYearlyEnabled: false,
    } as SubscriptionAddon;

    expect(addonPriceCycleSuffix(recurring, "monthly")).toBe("/mo");
    expect(addonPriceCycleSuffix(recurring, "yearly")).toBe("/yr");
    expect(addonPriceCycleSuffix(oneTime, "monthly")).toBe("one-time");
  });
});
