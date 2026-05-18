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
  resolveExtraEditAddonPriceCents,
} from "../src/services/extraEditCredits.mjs";

const planRow = (overrides: Record<string, unknown> = {}) => ({
  id: "p1",
  code: "sitropix_growth",
  includedEditCreditsPerPeriod: 2,
  catalogJson: {
    maxPurchasedEditCreditsBalance: 24,
    ...overrides,
  },
});

const addonRow = (code: string, catalog: Record<string, unknown> = {}) => ({
  code,
  priceCents: 1000,
  catalogJson: catalog,
});

describe("extraEditCredits", () => {
  const singleCatalog = {
    effectKind: "credit_pack",
    extraEditTier: "single",
    planPricing: {
      sitropix_growth: { priceCents: 1000 },
    },
  };

  const bundleCatalog = {
    effectKind: "credit_pack",
    extraEditTier: "bundle",
    planPricing: {
      sitropix_growth: { priceCents: 3900, creditsGranted: 5 },
    },
  };

  it("marks official and credit_pack add-ons as repeatable purchases", () => {
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

  it("resolves single and bundle grants from add-on planPricing", () => {
    const p = planRow();
    expect(
      resolveCreditPackGrantForAddon(p, addonRow(EXTRA_EDIT_SINGLE_CODE, singleCatalog)),
    ).toBe(1);
    expect(
      resolveCreditPackGrantForAddon(p, addonRow(EXTRA_EDIT_BUNDLE_CODE, bundleCatalog)),
    ).toBe(5);
    expect(
      resolveExtraEditAddonPriceCents(p, addonRow(EXTRA_EDIT_SINGLE_CODE, singleCatalog)),
    ).toBe(1000);
    expect(
      resolveExtraEditAddonPriceCents(p, addonRow(EXTRA_EDIT_BUNDLE_CODE, bundleCatalog)),
    ).toBe(3900);
  });

  it("reads max purchased balance from plan catalog", () => {
    expect(readMaxPurchasedEditCreditsBalance(planRow())).toBe(24);
    expect(readMaxPurchasedEditCreditsBalance(planRow({ maxPurchasedEditCreditsBalance: undefined }))).toBe(
      50,
    );
  });

  it("assertCreditPurchaseUnderCap always allows purchases (no cap)", () => {
    const p = planRow();
    const r = assertCreditPurchaseUnderCap({
      plan: p,
      subscriptionRow: { purchasedCreditsBalance: 22 },
      purchasedDelta: 500,
    });
    expect(r.ok).toBe(true);
  });

  it("readPlanTotalWebsiteEditCreditsLimit sums included allowance and max purchased balance", () => {
    expect(readPlanTotalWebsiteEditCreditsLimit(planRow())).toBe(2 + 24);
  });

  it("assertWebsiteEditPurchaseAllowed always allows purchases (no cap)", () => {
    const p = planRow();
    const r = assertWebsiteEditPurchaseAllowed({
      plan: p,
      subscriptionRow: {
        includedCreditsPerPeriod: 10,
        includedCreditsUsedThisPeriod: 0,
        purchasedCreditsBalance: 0,
      },
      purchasedDelta: 999,
    });
    expect(r.ok).toBe(true);
  });
});
