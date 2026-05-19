import { describe, expect, it } from "vitest";
import { assertRecurringAddonStripeStoreReady } from "../src/services/recurringAddonStripeStore.mjs";

describe("recurringAddonStripeStore", () => {
  it("exposes ProjectRecurringAddonStripe on the generated Prisma client", () => {
    const ready = assertRecurringAddonStripeStoreReady();
    expect(ready.ok).toBe(true);
  });
});
