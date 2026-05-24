import { describe, expect, it } from "vitest";
import { normalizeRouteKey } from "../src/observability/metrics.mjs";

describe("metrics normalizeRouteKey", () => {
  it("collapses cuid-like segments", () => {
    expect(
      normalizeRouteKey("GET", "/api/admin/users/clxyz12345678901234567/docs"),
    ).toBe("GET /api/admin/users/:id/docs");
  });

  it("leaves short segments", () => {
    expect(normalizeRouteKey("POST", "/api/auth/login")).toBe("POST /api/auth/login");
  });
});
