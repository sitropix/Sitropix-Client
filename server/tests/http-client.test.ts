import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../../src/services/http";

describe("ApiRequestError", () => {
  it("exposes status and code", () => {
    const e = new ApiRequestError("not allowed", 403, "module_forbidden", undefined, undefined);
    expect(e.name).toBe("ApiRequestError");
    expect(e.message).toBe("not allowed");
    expect(e.status).toBe(403);
    expect(e.code).toBe("module_forbidden");
  });
});
