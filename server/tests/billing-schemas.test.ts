import { describe, expect, it } from "vitest";
import { changePlanSchema, checkoutSessionSchema, funnelEventSchema } from "../src/schemas/billingSchemas.mjs";

describe("billing Zod schemas", () => {
  it("changePlanSchema accepts planId and optional cycle", () => {
    expect(changePlanSchema.parse({ planId: "c123" })).toEqual({ planId: "c123" });
    expect(changePlanSchema.parse({ planId: "c123", billingCycle: "yearly" })).toEqual({
      planId: "c123",
      billingCycle: "yearly",
    });
  });

  it("changePlanSchema rejects empty planId", () => {
    expect(() => changePlanSchema.parse({ planId: "" })).toThrow();
  });

  it("checkoutSessionSchema validates optional URLs as proper URLs", () => {
    expect(() =>
      checkoutSessionSchema.parse({
        planId: "x",
        projectId: "proj1",
        successUrl: "not-a-url",
      }),
    ).toThrow();
    expect(
      checkoutSessionSchema.parse({
        planId: "p1",
        projectId: "proj1",
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/cancel",
      }),
    ).toMatchObject({ planId: "p1", projectId: "proj1" });
  });

  it("funnelEventSchema allowlists event names", () => {
    expect(
      funnelEventSchema.parse({ name: "subscription_plans_viewed", properties: { n: 2 } }),
    ).toEqual({ name: "subscription_plans_viewed", properties: { n: 2 } });
    expect(() => funnelEventSchema.parse({ name: "unknown_event" })).toThrow();
  });
});
