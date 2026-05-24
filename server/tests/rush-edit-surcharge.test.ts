import { describe, expect, it } from "vitest";
import { isAddonEligibleForSupportTickets } from "../src/services/addonUtilizationTracking.mjs";
import {
  isRushEditSurchargeAddon,
  projectOwnsRushEditSurcharge,
  RUSH_EDIT_SURCHARGE_CODE,
} from "../src/services/rushEditSurcharge.mjs";

describe("rushEditSurcharge", () => {
  it("detects rush edit add-on code", () => {
    expect(isRushEditSurchargeAddon({ code: RUSH_EDIT_SURCHARGE_CODE })).toBe(true);
    expect(isRushEditSurchargeAddon({ code: "addon_other" })).toBe(false);
  });

  it("reads ownership from project addonsJson", () => {
    expect(projectOwnsRushEditSurcharge([RUSH_EDIT_SURCHARGE_CODE, "addon_x"])).toBe(true);
    expect(projectOwnsRushEditSurcharge([])).toBe(false);
  });

  it("excludes rush edit from add-on support ticket dropdown eligibility", () => {
    expect(
      isAddonEligibleForSupportTickets({
        code: RUSH_EDIT_SURCHARGE_CODE,
        isActive: true,
        billingKind: "per_use",
        catalogJson: { effectKind: "per_ticket" },
      }),
    ).toBe(false);
  });
});
