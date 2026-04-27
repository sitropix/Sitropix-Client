import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../../src/services/http";

describe("ApiRequestError", () => {
  it("exposes status and body", () => {
    const e = new ApiRequestError("not allowed", 403, { error: "forbidden", requestId: "r1" });
    expect(e.name).toBe("ApiRequestError");
    expect(e.message).toBe("not allowed");
    expect(e.status).toBe(403);
    expect(e.body.error).toBe("forbidden");
  });
});
