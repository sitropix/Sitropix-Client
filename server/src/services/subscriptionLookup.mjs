import { prisma } from "../db/client.mjs";

/**
 * Resolve a user's "primary" subscription for legacy user-level pages.
 * Order of preference:
 *   1. Most-recent active or trialing subscription
 *   2. Most-recent subscription of any state
 * Returns null if the user has no subscription rows.
 */
export async function findPrimaryUserSubscription(userId, options = {}) {
  if (!userId) return null;
  const { include } = options;
  const live = await prisma.subscription.findFirst({
    where: { userId, status: { in: ["active", "trialing", "past_due", "paused"] } },
    orderBy: { updatedAt: "desc" },
    include,
  });
  if (live) return live;
  return prisma.subscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include,
  });
}

/**
 * Resolve the subscription for a specific (user, project) pair.
 * Returns null if no row exists yet.
 */
export async function findUserProjectSubscription(userId, projectId, options = {}) {
  if (!userId || !projectId) return null;
  const { include } = options;
  return prisma.subscription.findFirst({
    where: { userId, projectId },
    include,
  });
}

/**
 * Resolve a subscription via Stripe id (cross-user lookup, used by webhook handlers).
 */
export async function findSubscriptionByStripeId(stripeSubscriptionId, options = {}) {
  if (!stripeSubscriptionId) return null;
  const { include } = options;
  return prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    include,
  });
}

/**
 * Upsert a subscription tied to a project. Falls back to a user-level legacy row
 * (projectId = NULL) when no projectId is provided.
 *
 * Uses (userId, projectId) composite uniqueness via findFirst + create/update so we
 * don't have to deal with Prisma composite unique semantics for nullable fields.
 */
export async function upsertProjectSubscription({ userId, projectId, create, update }) {
  if (!projectId) throw new Error("project_id_required");
  const existing = await prisma.subscription.findFirst({ where: { userId, projectId } });
  if (existing) {
    return prisma.subscription.update({
      where: { id: existing.id },
      data: update,
    });
  }
  return prisma.subscription.create({
    data: {
      userId,
      projectId,
      ...create,
    },
  });
}
