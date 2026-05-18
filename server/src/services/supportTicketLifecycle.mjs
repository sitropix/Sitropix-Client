import { refundSubscriptionCreditsTx } from "./subscriptionCredits.mjs";

/** Resolved with work delivered — credits stay deducted unless already refunded. */
export function isTicketResolvedAndCompleted(ticket) {
  return ticket?.status === "resolved" && ticket.workCompleted !== false;
}

export function canUserCloseTicket(ticket) {
  if (!ticket || ticket.status === "closed") return false;
  return !isTicketResolvedAndCompleted(ticket);
}

export function canUserDeleteTicket(ticket) {
  return isTicketResolvedAndCompleted(ticket);
}

export function canUserReopenTicket(ticket) {
  return ticket?.status === "closed";
}

export function isTicketClosedByUser(ticket) {
  return ticket?.status === "closed";
}

export async function refundTicketCreditsIfNeeded(tx, ticket) {
  if ((ticket.creditsCharged ?? 0) <= 0 || ticket.creditsRefunded || !ticket.projectId) {
    return { refunded: false };
  }
  const sub = await tx.subscription.findFirst({
    where: {
      userId: ticket.userId,
      projectId: ticket.projectId,
      status: { not: "canceled" },
    },
  });
  if (!sub) return { refunded: false };
  await refundSubscriptionCreditsTx(
    tx,
    sub.id,
    ticket.creditsFromIncluded,
    ticket.creditsFromPurchased,
  );
  return { refunded: true };
}
