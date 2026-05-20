import { describe, expect, it } from "vitest";
import {
  priorityFromPlanSupportChannel,
  resolveSupportTicketPriority,
} from "../src/services/supportTicketPriority.mjs";

describe("supportTicketPriority", () => {
  it("maps supportChannel from catalog to queue priority", () => {
    expect(priorityFromPlanSupportChannel({ supportChannel: "email_48h" })).toBe("low");
    expect(priorityFromPlanSupportChannel({ supportChannel: "email_chat_24h" })).toBe("medium");
    expect(priorityFromPlanSupportChannel({ supportChannel: "priority_4h" })).toBe("high");
  });

  it("resolveSupportTicketPriority prefers support channel over plan code", () => {
    const p = resolveSupportTicketPriority({
      planCode: "sitropix_pro",
      catalogJson: { supportChannel: "email_48h" },
      boostUntil: null,
    });
    expect(p).toBe("low");
  });

  it("resolveSupportTicketPriority falls back to plan code when channel missing", () => {
    expect(
      resolveSupportTicketPriority({
        planCode: "sitropix_growth",
        catalogJson: {},
        boostUntil: null,
      }),
    ).toBe("medium");
  });

  it("boost forces high", () => {
    const future = new Date(Date.now() + 86400000);
    expect(
      resolveSupportTicketPriority({
        planCode: "sitropix_starter",
        catalogJson: { supportChannel: "email_48h" },
        boostUntil: future,
      }),
    ).toBe("high");
  });

  it("rush edit surcharge forces urgent over plan channel and boost", () => {
    const future = new Date(Date.now() + 86400000);
    expect(
      resolveSupportTicketPriority({
        planCode: "sitropix_starter",
        catalogJson: { supportChannel: "email_48h" },
        boostUntil: future,
        rushEditActive: true,
      }),
    ).toBe("urgent");
  });
});
