import { describe, expect, it } from "vitest";
import {
  assertCreditPurchaseUnderCap,
  EXTRA_EDIT_BUNDLE_CODE,
  EXTRA_EDIT_SINGLE_CODE,
  readMaxPurchasedEditCreditsBalance,
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
  it("resolves single and bundle grants from plan catalog", () => {
    const p = planRow();
    expect(resolveCreditPackGrantForAddon(p, addonRow(EXTRA_EDIT_SINGLE_CODE))).toBe(1);
    expect(resolveCreditPackGrantForAddon(p, addonRow(EXTRA_EDIT_BUNDLE_CODE))).toBe(5);
  });

  it("reads max purchased balance from catalog", () => {
    expect(readMaxPurchasedEditCreditsBalance(planRow())).toBe(24);
    expect(readMaxPurchasedEditCreditsBalance(planRow({ maxPurchasedEditCreditsBalance: undefined }))).toBeGreaterThan(
      20,
    );
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
});
