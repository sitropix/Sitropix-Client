import { describe, expect, it } from "vitest";
import {
  resolveUtilizationCycleBounds,
  resolveAddonRecurringProfile,
  bundledAddonCodesForPlan,
  isAddonEligibleForSupportTickets,
} from "../src/services/addonUtilizationTracking.mjs";

describe("addonUtilizationTracking", () => {
  it("treats one-time add-ons as non-recurring", () => {
    const p = resolveAddonRecurringProfile({
      billingKind: "one_time",
      setupFeeCents: 0,
      billingMonthlyEnabled: false,
      billingYearlyEnabled: false,
    });
    expect(p.isRecurring).toBe(false);
    expect(p.recurringType).toBe("one_time");
  });

  it("detects setup fee on recurring add-ons", () => {
    const p = resolveAddonRecurringProfile({
      billingKind: "recurring",
      setupFeeCents: 29900,
      billingMonthlyEnabled: true,
      billingYearlyEnabled: true,
    });
    expect(p.isRecurring).toBe(true);
    expect(p.hasSetupFee).toBe(true);
  });

  it("uses full subscription period for yearly recurring utilization", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2027-01-01T00:00:00.000Z");
    const { cycleStart, cycleEnd } = resolveUtilizationCycleBounds({
      recurringType: "yearly",
      addonBillingCycle: "yearly",
      subscriptionPeriodStart: start,
      subscriptionPeriodEnd: end,
      now: new Date("2026-06-15T00:00:00.000Z"),
    });
    expect(cycleStart.toISOString()).toBe(start.toISOString());
    expect(cycleEnd.toISOString()).toBe(end.toISOString());
  });

  it("splits monthly utilization within a yearly subscription period", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2027-01-01T00:00:00.000Z");
    const { cycleStart, cycleEnd } = resolveUtilizationCycleBounds({
      recurringType: "monthly",
      addonBillingCycle: "monthly",
      subscriptionPeriodStart: start,
      subscriptionPeriodEnd: end,
      now: new Date("2026-03-15T00:00:00.000Z"),
    });
    expect(cycleStart.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(cycleEnd.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("maps bundled plan flags to add-on codes", () => {
    const codes = bundledAddonCodesForPlan({
      catalogJson: { monthlySeoReport: true, liveChatIncluded: false },
    }).map((b) => b.code);
    expect(codes).toContain("addon_monthly_seo_report");
    expect(codes).not.toContain("addon_live_chat_starter");
  });

  it("excludes credit-pack add-ons from ticket eligibility", () => {
    expect(
      isAddonEligibleForSupportTickets({
        code: "addon_extra_edit_single",
        isActive: true,
        billingKind: "one_time",
        catalogJson: { effectKind: "credit_pack", extraEditTier: "single" },
      }),
    ).toBe(false);
  });

  it("includes consumable one-time add-ons", () => {
    expect(
      isAddonEligibleForSupportTickets({
        code: "addon_google_business_profile",
        isActive: true,
        billingKind: "one_time",
        catalogJson: { effectKind: "consumable_service" },
      }),
    ).toBe(true);
  });
});
