import { describe, expect, it } from "vitest";
import {
  buildRecurringAttachEntry,
  recurringAddonFirstCheckoutCents,
  resolveChosenAddonRecurringCycle,
} from "../src/services/recurringAddonCheckout.mjs";

const addonRow = (overrides: Record<string, unknown> = {}) => ({
  code: "addon_analytics_dashboard",
  label: "Analytics",
  priceCents: 2500,
  billingKind: "recurring",
  setupFeeCents: 0,
  billingMonthlyEnabled: true,
  billingYearlyEnabled: true,
  catalogJson: {
    planPricing: {
      sitropix_pro: { monthlyCents: 2500, yearlyCents: 25000 },
    },
  },
  ...overrides,
});

const plan = { id: "p1", code: "sitropix_pro" };

describe("recurringAddonCheckout", () => {
  it("forces monthly cycle when subscription is monthly", () => {
    expect(resolveChosenAddonRecurringCycle("monthly", addonRow(), "yearly")).toBe("monthly");
  });

  it("allows monthly or yearly choice when subscription is yearly", () => {
    expect(resolveChosenAddonRecurringCycle("yearly", addonRow(), "monthly")).toBe("monthly");
    expect(resolveChosenAddonRecurringCycle("yearly", addonRow(), "yearly")).toBe("yearly");
  });

  it("prices first checkout from chosen cycle", () => {
    expect(recurringAddonFirstCheckoutCents(addonRow(), plan, "monthly")).toBe(2500);
    expect(recurringAddonFirstCheckoutCents(addonRow(), plan, "yearly")).toBe(25000);
  });

  it("builds attach metadata for Stripe subscription item", () => {
    const entry = buildRecurringAttachEntry(addonRow(), plan, "monthly");
    expect(entry.code).toBe("addon_analytics_dashboard");
    expect(entry.recurringAmountCents).toBe(2500);
    expect(entry.interval).toBe("month");
    expect(entry.chosenCycle).toBe("monthly");
  });
});
