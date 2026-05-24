import { prisma } from "../db/client.mjs";
import { log } from "../observability/logger.mjs";
import { assertStripeConfigured, stripe } from "./stripeService.mjs";

/**
 * Resolve a Stripe customer for addon checkout / billing portal.
 * Backfills `user.stripeCustomerId` and the subscription row when found.
 * Creates a new Stripe customer when none exists (e.g. one-time plan without stored customer id).
 */
export async function resolveOrCreateStripeCustomerId(userId, subscriptionRow = null) {
  try {
    assertStripeConfigured();
  } catch {
    return {
      ok: false,
      reason: "stripe_not_configured",
      message: "Stripe is not configured on the server.",
    };
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, reason: "user_not_found" };

  async function persist(customerId) {
    if (!customerId) return;
    const updates = [
      prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      }),
    ];
    if (subscriptionRow?.id) {
      updates.push(
        prisma.subscription.update({
          where: { id: subscriptionRow.id },
          data: { stripeCustomerId: customerId },
        }),
      );
    }
    await Promise.all(updates);
  }

  const onSubscription = subscriptionRow?.stripeCustomerId?.trim() || null;
  if (onSubscription) {
    if (user.stripeCustomerId !== onSubscription) await persist(onSubscription);
    return { ok: true, customerId: onSubscription };
  }

  if (user.stripeCustomerId?.trim()) {
    const customerId = user.stripeCustomerId.trim();
    await persist(customerId);
    return { ok: true, customerId };
  }

  const stripeSubId = subscriptionRow?.stripeSubscriptionId?.trim() || null;
  if (stripeSubId) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
      const customerId =
        typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer?.id ?? null;
      if (customerId) {
        await persist(customerId);
        return { ok: true, customerId };
      }
    } catch (e) {
      log.warn("stripe.customer_resolve.subscription_fetch_failed", {
        userId,
        stripeSubId,
        error: e?.message,
      });
    }
  }

  try {
    const { data: customers } = await stripe.customers.list({ email: user.email, limit: 8 });
    const lower = user.email.toLowerCase();
    const match =
      customers.find((c) => c.email?.toLowerCase() === lower) ??
      (customers.length === 1 ? customers[0] : null);
    if (match?.id) {
      await persist(match.id);
      return { ok: true, customerId: match.id };
    }
  } catch (e) {
    log.warn("stripe.customer_resolve.list_by_email_failed", { userId, error: e?.message });
  }

  try {
    const created = await stripe.customers.create({
      email: user.email,
      name: user.name?.trim() || undefined,
      metadata: { userId },
    });
    await persist(created.id);
    log.info("stripe.customer_resolve.created", { userId, customerId: created.id });
    return { ok: true, customerId: created.id };
  } catch (e) {
    log.error("stripe.customer_resolve.create_failed", { userId, error: e?.message });
    return {
      ok: false,
      reason: "stripe_customer_create_failed",
      message: e?.message ?? "Could not create Stripe customer.",
    };
  }
}
