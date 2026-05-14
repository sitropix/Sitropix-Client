import { prisma } from "../db/client.mjs";

function now() {
  return new Date();
}

/** Drop invite rows past expiry that were never accepted (signup token is dead). */
export async function deleteExpiredPendingInvites() {
  const { count } = await prisma.invite.deleteMany({
    where: { acceptedAt: null, expiresAt: { lt: now() } },
  });
  return count;
}

/** Remove a single invite if it is expired and still pending (used after failed public lookups). */
export async function deleteInviteRowIfExpiredPending(inviteId) {
  const { count } = await prisma.invite.deleteMany({
    where: { id: inviteId, acceptedAt: null, expiresAt: { lt: now() } },
  });
  return count;
}
