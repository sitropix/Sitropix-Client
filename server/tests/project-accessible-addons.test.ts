import { describe, expect, it } from "vitest";
import {
  addonAllowedOnBillingCycle,
  isCreditPackAddon,
  resolveExtraEditPurchaseSummary,
  resolveProjectAccessibleAddons,
} from "../src/services/projectAccessibleAddons.mjs";

const proPlan = {
  id: "p-pro",
  code: "sitropix_pro",
  billingMonthlyEnabled: true,
  billingYearlyEnabled: true,
};

const growthPlan = {
  id: "p-growth",
  code: "sitropix_growth",
  billingMonthlyEnabled: true,
  billingYearlyEnabled: true,
};

const addon = (overrides: Record<string, unknown>) => ({
  code: "addon_test",
  label: "Test",
  desc: "",
  priceCents: 1000,
  currency: "USD",
  isActive: true,
  billingMonthlyEnabled: true,
  billingYearlyEnabled: true,
  billingKind: "recurring",
  setupFeeCents: 0,
  eligiblePlanCodes: ["sitropix_pro"],
  catalogJson: {},
  ...overrides,
});

describe("projectAccessibleAddons", () => {
  it("treats credit-pack SKUs separately from accessible add-ons", () => {
    expect(
      isCreditPackAddon(
        addon({ code: "addon_extra_edit_single", catalogJson: { extraEditTier: "single" } }),
      ),
    ).toBe(true);
    expect(isCreditPackAddon(addon({ code: "addon_analytics_dashboard" }))).toBe(false);
  });

  it("returns all plan-eligible recurring add-ons for Pro (not only one-time)", () => {
    const catalog = [
      addon({ code: "addon_analytics_dashboard", eligiblePlanCodes: ["sitropix_pro"] }),
      addon({ code: "addon_rush_edit_surcharge", billingKind: "per_use", eligiblePlanCodes: ["sitropix_pro"] }),
      addon({
        code: "addon_ecommerce_bolt_on",
        eligiblePlanCodes: ["sitropix_starter", "sitropix_growth"],
        setupFeeCents: 29900,
      }),
      addon({ code: "addon_extra_edit_single", catalogJson: { extraEditTier: "single" } }),
    ];

    const { existing, purchasable } = resolveProjectAccessibleAddons({
      catalog,
      plan: proPlan,
      billingCycle: "yearly",
      ownedAddonCodes: [],
    });

    expect(existing).toHaveLength(0);
    expect(purchasable.map((a) => a.code).sort()).toEqual([
      "addon_analytics_dashboard",
      "addon_rush_edit_surcharge",
    ]);
  });

  it("splits owned vs purchasable", () => {
    const catalog = [
      addon({ code: "addon_analytics_dashboard", eligiblePlanCodes: ["sitropix_growth"] }),
      addon({ code: "addon_photography_stock", billingKind: "one_time", eligiblePlanCodes: ["sitropix_growth"] }),
    ];

    const { existing, purchasable } = resolveProjectAccessibleAddons({
      catalog,
      plan: growthPlan,
      billingCycle: "monthly",
      ownedAddonCodes: ["addon_analytics_dashboard"],
    });

    expect(existing.map((a) => a.code)).toEqual(["addon_analytics_dashboard"]);
    expect(purchasable.map((a) => a.code)).toEqual(["addon_photography_stock"]);
  });

  it("keeps purchased add-ons in existing when plan tier no longer lists them", () => {
    const catalog = [
      addon({
        code: "addon_ecommerce_bolt_on",
        eligiblePlanCodes: ["sitropix_starter", "sitropix_growth"],
      }),
    ];

    const { existing, purchasable } = resolveProjectAccessibleAddons({
      catalog,
      plan: proPlan,
      billingCycle: "monthly",
      ownedAddonCodes: ["addon_ecommerce_bolt_on"],
    });

    expect(existing.map((a) => a.code)).toEqual(["addon_ecommerce_bolt_on"]);
    expect(purchasable).toHaveLength(0);
  });

  it("respects billing cycle flags", () => {
    const recurringMonthlyOnly = addon({
      code: "addon_monthly_only",
      billingYearlyEnabled: false,
      eligiblePlanCodes: ["sitropix_pro"],
    });
    expect(addonAllowedOnBillingCycle(recurringMonthlyOnly, "yearly", proPlan)).toBe(true);
    expect(addonAllowedOnBillingCycle(recurringMonthlyOnly, "monthly", proPlan)).toBe(true);

    const oneTimeYearlyOnly = addon({
      code: "addon_oty",
      billingKind: "one_time",
      billingMonthlyEnabled: false,
      billingYearlyEnabled: true,
      eligiblePlanCodes: ["sitropix_pro"],
    });
    expect(addonAllowedOnBillingCycle(oneTimeYearlyOnly, "yearly", proPlan)).toBe(true);
    expect(addonAllowedOnBillingCycle(oneTimeYearlyOnly, "monthly", proPlan)).toBe(false);
  });

  it("summarizes extra-edit purchase options for a plan", () => {
    const catalog = [
      addon({
        code: "addon_extra_edit_single",
        catalogJson: {
          extraEditTier: "single",
          planPricing: { sitropix_pro: { priceCents: 800 } },
        },
      }),
      addon({
        code: "addon_extra_edit_bundle",
        catalogJson: {
          extraEditTier: "bundle",
          planPricing: { sitropix_pro: { priceCents: 6900, creditsGranted: 10 } },
        },
      }),
    ];

    const summary = resolveExtraEditPurchaseSummary(catalog, proPlan);
    expect(summary.available).toBe(true);
    expect(summary.perEditCents).toBe(800);
    expect(summary.bundleCredits).toBe(10);
    expect(summary.bundleCents).toBe(6900);
    expect(summary.singleAddonCode).toBe("addon_extra_edit_single");
  });
});
