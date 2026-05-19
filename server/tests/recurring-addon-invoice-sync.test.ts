import { describe, expect, it } from "vitest";
import { formatRecurringAddonInvoiceNumber } from "../src/services/recurringAddonInvoiceSync.mjs";

describe("recurringAddonInvoiceSync", () => {
  it("formats add-on renewal invoice numbers for the portal", () => {
    expect(formatRecurringAddonInvoiceNumber("Analytics Dashboard", "INV-1001")).toBe(
      "Analytics Dashboard (add-on) · INV-1001",
    );
  });

  it("falls back when label is empty", () => {
    expect(formatRecurringAddonInvoiceNumber("", "x")).toBe("Add-on (add-on) · x");
  });
});
