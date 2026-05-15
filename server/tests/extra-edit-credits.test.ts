import { describe, expect, it } from "vitest";
import {
  assertCreditPurchaseUnderCap,
  assertWebsiteEditPurchaseAllowed,
  EXTRA_EDIT_BUNDLE_CODE,
  EXTRA_EDIT_SINGLE_CODE,
  isRepeatableExtraEditPurchase,
  readMaxPurchasedEditCreditsBalance,
  readPlanTotalWebsiteEditCreditsLimit,
  resolveCreditPackGrantForAddon,
} from "../src/services/extraEditCredits.mjs";

const planRow = (overrides: Record<string, unknown> = {}) => ({
  id: "p1",
  code: "sitropix_starter",
  includedEditCreditsPerPeriod: 2,
  catalogJson: {
    extraEditSingleCents: 1200,
    extraEditPackCount: 5,
    extraEditPackCents: 4900,
    maxPurchasedEditCreditsBalance: 24,
    ...overrides,
  },
});

const addonRow = (code: string, catalog: Record<string, unknown> = {}) => ({
  code,
  priceCents: 0,
  catalogJson: catalog,
});

describe("extraEditCredits", () => {
  it("marks plan-priced and credit_pack add-ons as repeatable purchases", () => {
    expect(isRepeatableExtraEditPurchase(addonRow(EXTRA_EDIT_SINGLE_CODE))).toBe(true);
    expect(isRepeatableExtraEditPurchase(addonRow(EXTRA_EDIT_BUNDLE_CODE))).toBe(true);
    expect(
      isRepeatableExtraEditPurchase(
        addonRow("addon_seo", { effectKind: "priority_boost" }),
      ),
    ).toBe(false);
    expect(
      isRepeatableExtraEditPurchase(
        addonRow("legacy_pack", { effectKind: "credit_pack" }),
      ),
    ).toBe(true);
  });

  it("resolves single and bundle grants from plan catalog", () => {
    const p = planRow();
    expect(resolveCreditPackGrantForAddon(p, addonRow(EXTRA_EDIT_SINGLE_CODE))).toBe(1);
    expect(resolveCreditPackGrantForAddon(p, addonRow(EXTRA_EDIT_BUNDLE_CODE))).toBe(5);
  });

  it("reads max purchased balance from catalog", () => {
    expect(readMaxPurchasedEditCreditsBalance(planRow())).toBe(24);
    expect(readMaxPurchasedEditCreditsBalance(planRow({ maxPurchasedEditCreditsBalance: undefined }))).toBe(5);
  });

  it("assertCreditPurchaseUnderCap blocks when over cap", () => {
    const p = planRow();
    const r = assertCreditPurchaseUnderCap({
      plan: p,
      subscriptionRow: { purchasedCreditsBalance: 22 },
      purchasedDelta: 5,
    });
    expect(r.ok).toBe(false);
    const ok = assertCreditPurchaseUnderCap({
      plan: p,
      subscriptionRow: { purchasedCreditsBalance: 10 },
      purchasedDelta: 5,
    });
    expect(ok.ok).toBe(true);
  });

  it("readPlanTotalWebsiteEditCreditsLimit sums included allowance and max purchased balance", () => {
    expect(readPlanTotalWebsiteEditCreditsLimit(planRow())).toBe(2 + 24);
  });

  it("assertWebsiteEditPurchaseAllowed blocks when total on-hand credits would exceed plan limit", () => {
    const p = planRow();
    const r = assertWebsiteEditPurchaseAllowed({
      plan: p,
      subscriptionRow: {
        /** Higher than `plan.includedEditCreditsPerPeriod` — enforces plan catalog cap vs actual wallet. */
        includedCreditsPerPeriod: 10,
        includedCreditsUsedThisPeriod: 0,
        purchasedCreditsBalance: 0,
      },
      purchasedDelta: 20,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("website_edit_credits_plan_limit_exceeded");
  });

  it("assertWebsiteEditPurchaseAllowed allows purchase when within both caps", () => {
    const p = planRow();
    const ok = assertWebsiteEditPurchaseAllowed({
      plan: p,
      subscriptionRow: {
        includedCreditsPerPeriod: 2,
        includedCreditsUsedThisPeriod: 1,
        purchasedCreditsBalance: 10,
      },
      purchasedDelta: 5,
    });
    expect(ok.ok).toBe(true);
  });
});
