import type { TicketStatus } from "@/types/support";

export type TicketLike = {
  status: TicketStatus;
  workCompleted?: boolean | null;
};

export function isTicketResolvedAndCompleted(ticket: TicketLike): boolean {
  return ticket.status === "resolved" && ticket.workCompleted !== false;
}

export function canUserCloseTicket(ticket: TicketLike): boolean {
  if (ticket.status === "closed") return false;
  return !isTicketResolvedAndCompleted(ticket);
}

export function canUserDeleteTicket(ticket: TicketLike): boolean {
  return isTicketResolvedAndCompleted(ticket);
}

export function canUserReopenTicket(ticket: TicketLike): boolean {
  return ticket.status === "closed";
}

export function isTicketClosedByUser(ticket: TicketLike): boolean {
  return ticket.status === "closed";
}

export function isTicketReplyable(ticket: TicketLike): boolean {
  return ticket.status !== "closed" && ticket.status !== "resolved";
}
