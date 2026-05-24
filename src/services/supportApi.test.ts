import { describe, expect, it } from "vitest";
import { ApiRequestError } from "@/services/http";
import { messageForTicketSubmitError } from "@/services/supportApi";

describe("messageForTicketSubmitError", () => {
  it("formats insufficient_credits with needed and available", () => {
    const err = new ApiRequestError(
      "This edit requires 3 website edit credits, but only 0 are available on this project.",
      400,
      "insufficient_credits",
      undefined,
      undefined,
      { needed: 3, available: 0 },
    );
    expect(messageForTicketSubmitError(err)).toMatch(/requires 3 website edit credits/);
    expect(messageForTicketSubmitError(err)).toMatch(/only 0 are available/);
    expect(messageForTicketSubmitError(err)).toMatch(/project dashboard/i);
  });

  it("uses server message when needed/available are missing", () => {
    const err = new ApiRequestError(
      "This edit requires 2 website edit credits, but only 1 is available on this project.",
      400,
      "insufficient_credits",
    );
    expect(messageForTicketSubmitError(err)).toBe(err.message);
  });
});
