import { describe, expect, it } from "vitest";
import {
  canUserCloseTicket,
  canUserDeleteTicket,
  canUserReopenTicket,
  isTicketClosedByUser,
  isTicketResolvedAndCompleted,
} from "../src/services/supportTicketLifecycle.mjs";

describe("supportTicketLifecycle", () => {
  it("treats resolved with work completed as not closable but deletable", () => {
    const t = { status: "resolved", workCompleted: true };
    expect(isTicketResolvedAndCompleted(t)).toBe(true);
    expect(canUserCloseTicket(t)).toBe(false);
    expect(canUserDeleteTicket(t)).toBe(true);
  });

  it("allows close when open or resolved without completed work", () => {
    expect(canUserCloseTicket({ status: "open", workCompleted: null })).toBe(true);
    expect(canUserCloseTicket({ status: "resolved", workCompleted: false })).toBe(true);
    expect(canUserDeleteTicket({ status: "resolved", workCompleted: false })).toBe(false);
  });

  it("does not allow close or delete when already closed", () => {
    const t = { status: "closed", workCompleted: null };
    expect(canUserCloseTicket(t)).toBe(false);
    expect(canUserDeleteTicket(t)).toBe(false);
  });

  it("allows reopen only when closed", () => {
    expect(canUserReopenTicket({ status: "closed" })).toBe(true);
    expect(canUserReopenTicket({ status: "open" })).toBe(false);
    expect(isTicketClosedByUser({ status: "closed" })).toBe(true);
  });
});
