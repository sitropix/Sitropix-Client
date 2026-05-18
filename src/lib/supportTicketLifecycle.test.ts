import { describe, expect, it } from "vitest";
import {
  canUserCloseTicket,
  canUserDeleteTicket,
  canUserReopenTicket,
  isTicketClosedByUser,
  isTicketReplyable,
  isTicketResolvedAndCompleted,
} from "./supportTicketLifecycle";

describe("supportTicketLifecycle (client)", () => {
  it("matches server rules for resolved/completed", () => {
    expect(isTicketResolvedAndCompleted({ status: "resolved", workCompleted: true })).toBe(true);
    expect(isTicketReplyable({ status: "resolved", workCompleted: true })).toBe(false);
    expect(isTicketReplyable({ status: "open" })).toBe(true);
    expect(canUserCloseTicket({ status: "in_progress" })).toBe(true);
    expect(canUserDeleteTicket({ status: "resolved", workCompleted: true })).toBe(true);
    expect(canUserReopenTicket({ status: "closed" })).toBe(true);
    expect(isTicketClosedByUser({ status: "closed" })).toBe(true);
  });
});
