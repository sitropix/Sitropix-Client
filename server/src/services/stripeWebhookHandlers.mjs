import { prisma } from "../db/client.mjs";
import { sendTransactionalEmail } from "./emailService.mjs";
import { stripe } from "./stripeService.mjs";
import { env } from "../config/env.mjs";
import { log } from "../observability/logger.mjs";
import {
  mapStripeStatus,
  resolvePlanAndBillingCycle,
  stripePriceIdFromSubscriptionObject,
  subscriptionPeriodDates,
} from "./stripeSyncHelpers.mjs";

function logCheckout(phase, fields = {}) {
  log.info("billing.stripe_checkout", { phase, ...fields });
}

function projectIdFromMetadata(...metadataObjects) {
  for (const md of metadataObjects) {
    const candidate = md?.projectId;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

/**
 * Find the local Subscription row for a Stripe subscription. If none exists, locate
 * the (userId, projectId) target row (or fall back to the user-level legacy slot when
 * no projectId is known). Returns null when there is no row to upsert into.
 */
async function findSubscriptionTargetRow({ stripeSubscriptionId, userId, projectId }) {
  if (stripeSubscriptionId) {
    const byStripeId = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId },
    });
    if (byStripeId) return byStripeId;
  }
  if (!userId) return null;
  if (!projectId) return null;
  return prisma.subscription.findFirst({ where: { userId, projectId } });
}

/** Stripe may send `subscription` as an id string or (if expanded) an object. */
function subscriptionIdFromSession(session) {
  const s = session.subscription;
  if (!s) return null;
  if (typeof s === "string") return s;
  if (typeof s === "object" && s !== null && typeof s.id === "string") return s.id;
  return null;
}

async function findUserIdByStripeCustomerId(customerId) {
  if (!customerId) return null;
  const byCol = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
  if (byCol) return byCol.id;
  try {
    const c = await stripe.customers.retrieve(customerId);
    const email = c.email ?? c.metadata?.email;
    if (!email) return null;
    const u = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
    });
    return u?.id ?? null;
  } catch (e) {
    logCheckout("stripe_customer_lookup_failed", { customerId, error: e?.message });
    return null;
  }
}

async function ensureProjectIdForSubscription({ userId, projectId, stripeSubscriptionId = null }) {
  if (projectId) return projectId;
  const existingProjectSub =
    stripeSubscriptionId
      ? await prisma.subscription.findFirst({
          where: { stripeSubscriptionId, userId, projectId: { not: null } },
          select: { projectId: true },
        })
      : null;
  if (existingProjectSub?.projectId) return existingProjectSub.projectId;
  const latestProject = await prisma.project.findFirst({
    where: { ownerUserId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (latestProject?.id) return latestProject.id;
  const created = await prisma.project.create({
    data: {
      ownerUserId: userId,
      name: "Imported Subscription Project",
      description: "Auto-created to attach Stripe subscription.",
      subscriptionStatus: "on_hold",
      addonsJson: [],
      invoicesJson: [],
    },
    select: { id: true },
  });
  return created.id;
}

export async function handleCheckoutSessionCompleted(session) {
  if (session.mode && session.mode !== "subscription") {
    logCheckout("skip_wrong_mode", { sessionId: session.id, mode: session.mode });
    return;
  }

  const subId = subscriptionIdFromSession(session);
  if (!subId) {
    logCheckout("skip_no_subscription", { sessionId: session.id, hasField: Boolean(session.subscription) });
    return;
  }

  let stripeSub;
  try {
    stripeSub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
  } catch (e) {
    logCheckout("retrieve_subscription_failed", { sessionId: session.id, subId, error: e?.message });
    throw e;
  }

  const customerIdEarly = typeof session.customer === "string" ? session.customer : session.customer?.id;
  let userId = session.metadata?.userId || session.client_reference_id || null;
  if (!userId) {
    const email = session.customer_email || session.customer_details?.email;
    if (email) {
      const u = await prisma.user.findFirst({
        where: { email: { equals: email.trim(), mode: "insensitive" } },
      });
      if (u) {
        userId = u.id;
        logCheckout("resolved_user_by_email", { sessionId: session.id, userId });
      }
    }
  }
  if (!userId && customerIdEarly) {
    const byCust = await findUserIdByStripeCustomerId(customerIdEarly);
    if (byCust) {
      userId = byCust;
      logCheckout("resolved_user_by_customer", { sessionId: session.id, userId, customerId: customerIdEarly });
    }
  }

  let planId = session.metadata?.planId || null;
  let billingCycle = session.metadata?.billingCycle === "yearly" ? "yearly" : "monthly";
  if (!planId) {
    planId = stripeSub.metadata?.planId || null;
  }
  if (session.metadata?.billingCycle !== "yearly" && session.metadata?.billingCycle !== "monthly" && stripeSub.metadata?.billingCycle) {
    billingCycle = stripeSub.metadata.billingCycle === "yearly" ? "yearly" : "monthly";
  }

  let plan;
  if (planId) {
    plan = await prisma.plan.findUnique({ where: { id: planId } });
  }
  if (!plan) {
    const linePrice = stripePriceIdFromSubscriptionObject(stripeSub);
    const fromPrice = await resolvePlanAndBillingCycle(linePrice);
    if (fromPrice.plan) {
      plan = fromPrice.plan;
      billingCycle = fromPrice.billingCycle;
      logCheckout("resolved_plan_by_price", { sessionId: session.id, planId: plan.id, priceId: linePrice });
    }
  }

  if (!userId) {
    logCheckout("skip_no_user", { sessionId: session.id, subId, hasClientRef: Boolean(session.client_reference_id) });
    return;
  }
  if (!plan) {
    logCheckout("skip_no_plan", { sessionId: session.id, subId, userId, hadPlanId: Boolean(planId) });
    return;
  }

  const userRow = await prisma.user.findUnique({ where: { id: userId } });
  if (!userRow) {
    logCheckout("skip_user_missing", { sessionId: session.id, userId });
    return;
  }

  const customerId = typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer?.id;
  const projectId = await ensureProjectIdForSubscription({
    userId,
    projectId: projectIdFromMetadata(session.metadata, stripeSub.metadata),
    stripeSubscriptionId: stripeSub.id,
  });

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId ?? undefined },
    });

    const { start: periodStart, end: periodEnd } = subscriptionPeriodDates(stripeSub);
    const target = await findSubscriptionTargetRow({
      stripeSubscriptionId: stripeSub.id,
      userId,
      projectId,
    });
    const upsertData = {
      planId: plan.id,
      status: mapStripeStatus(stripeSub.status),
      billingCycle,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
      stripeSubscriptionId: stripeSub.id,
      stripeCustomerId: customerId,
      projectId,
    };
    if (target) {
      await prisma.subscription.update({ where: { id: target.id }, data: upsertData });
    } else {
      await prisma.subscription.create({
        data: {
          userId,
          projectId,
          ...upsertData,
        },
      });
    }
  } catch (e) {
    logCheckout("db_upsert_failed", { sessionId: session.id, userId, error: e?.message });
    throw e;
  }

  logCheckout("synced", {
    sessionId: session.id,
    userId,
    projectId,
    planCode: plan.code,
    stripeSubId: stripeSub.id,
  });

  if (userRow) {
    await sendTransactionalEmail({
      to: userRow.email,
      template: "subscription_confirmed",
      idempotencyKey: `sub_confirmed_${stripeSub.id}`,
      subject: "Subscription confirmed",
      html: `<p>Hi ${userRow.name},</p><p>Your subscription to <strong>${plan.name}</strong> is active.</p><p><a href="${env.appUrl}/billing">Billing dashboard</a></p>`,
    });
  }
}

export async function handleInvoicePaid(invoice) {
  logCheckout("invoice_paid_received", { invoiceId: invoice.id });
  if (!invoice.subscription || !invoice.customer) return;

  const stripeSubId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;

  let sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSubId },
  });
  if (!sub) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
      await handleSubscriptionUpdated(stripeSub);
      sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: stripeSubId } });
    } catch (e) {
      logCheckout("invoice_paid_subscription_recover_failed", {
        invoiceId: invoice.id,
        stripeSubId,
        error: e?.message,
      });
    }
  }
  if (!sub) return;

  const invNum = invoice.number ?? String(invoice.id);
  const paidAt =
    invoice.status_transitions?.paid_at != null
      ? new Date(invoice.status_transitions.paid_at * 1000)
      : new Date();
  const pdfUrl = invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? null;
  await prisma.payment.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      userId: sub.userId,
      subscriptionId: sub.id,
      invoiceNumber: invNum,
      amountCents: invoice.amount_paid ?? 0,
      currency: (invoice.currency ?? "usd").toUpperCase(),
      status: "succeeded",
      paidAt,
      stripeInvoiceId: invoice.id,
      invoicePdfUrl: pdfUrl,
    },
    update: {
      amountCents: invoice.amount_paid ?? 0,
      status: "succeeded",
      paidAt,
      invoicePdfUrl: pdfUrl,
    },
  });
  logCheckout("invoice_paid_synced", { invoiceId: invoice.id, stripeSubId, amountPaid: invoice.amount_paid ?? 0 });
}

export async function handleInvoicePaymentFailed(invoice) {
  logCheckout("invoice_payment_failed_received", { invoiceId: invoice.id });
  const stripeSubId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!stripeSubId) return;

  let sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: stripeSubId } });
  if (!sub) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
      await handleSubscriptionUpdated(stripeSub);
      sub = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: stripeSubId } });
    } catch (e) {
      logCheckout("invoice_failed_subscription_recover_failed", {
        invoiceId: invoice.id,
        stripeSubId,
        error: e?.message,
      });
    }
  }
  if (!sub) return;

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "past_due" },
  });

  const invNum = invoice.number ?? `failed_${invoice.id}`;
  await prisma.payment.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      userId: sub.userId,
      subscriptionId: sub.id,
      invoiceNumber: invNum,
      amountCents: invoice.amount_due ?? 0,
      currency: (invoice.currency ?? "usd").toUpperCase(),
      status: "failed",
      failureReason: invoice.last_finalization_error?.message ?? "payment_failed",
      stripeInvoiceId: invoice.id,
    },
    update: {
      amountCents: invoice.amount_due ?? 0,
      currency: (invoice.currency ?? "usd").toUpperCase(),
      status: "failed",
      failureReason: invoice.last_finalization_error?.message ?? "payment_failed",
    },
  });

  const user = await prisma.user.findUnique({ where: { id: sub.userId } });
  if (user) {
    await sendTransactionalEmail({
      to: user.email,
      template: "payment_failed",
      idempotencyKey: `pay_fail_${invoice.id}`,
      subject: "Payment failed — action required",
      html: `<p>Hi ${user.name},</p><p>We could not process your payment. Please update your payment method.</p><p><a href="${env.appUrl}/billing">Update billing</a></p>`,
    });
  }
  logCheckout("invoice_payment_failed_synced", { invoiceId: invoice.id, stripeSubId });
}

export async function handleSubscriptionUpdated(stripeSub) {
  logCheckout("subscription_updated_received", { stripeSubId: stripeSub.id, status: stripeSub.status });
  const existing = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSub.id },
  });

  if (existing) {
    const { start: periodStart, end: periodEnd } = subscriptionPeriodDates(stripeSub);
    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: mapStripeStatus(stripeSub.status),
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
        stripeCustomerId:
          typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer?.id ?? existing.stripeCustomerId,
      },
    });
    return;
  }

  const customerId = typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer?.id;
  let userId = stripeSub.metadata?.userId || null;
  let plan;
  let billingCycle = stripeSub.metadata?.billingCycle === "yearly" ? "yearly" : "monthly";

  const fromMetaPlanId = stripeSub.metadata?.planId;
  if (fromMetaPlanId) {
    plan = await prisma.plan.findUnique({ where: { id: fromMetaPlanId } });
  }
  if (!plan) {
    const linePrice = stripePriceIdFromSubscriptionObject(stripeSub);
    const fromPrice = await resolvePlanAndBillingCycle(linePrice);
    if (fromPrice.plan) {
      plan = fromPrice.plan;
      billingCycle = fromPrice.billingCycle;
      logCheckout("sub_event_resolved_plan_by_price", { stripeSubId: stripeSub.id, planId: plan.id });
    }
  }

  if (!userId && customerId) {
    const resolved = await findUserIdByStripeCustomerId(customerId);
    if (resolved) {
      userId = resolved;
      logCheckout("sub_event_resolved_user_by_customer", { stripeSubId: stripeSub.id, userId });
    }
  }

  if (!userId) {
    logCheckout("sub_event_skip_no_user", { stripeSubId: stripeSub.id, hasMetadata: Boolean(stripeSub.metadata?.userId) });
    return;
  }
  if (!plan) {
    logCheckout("sub_event_skip_no_plan", { stripeSubId: stripeSub.id, userId });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    logCheckout("sub_event_skip_user_or_plan", { stripeSubId: stripeSub.id, userId, planId: plan.id });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customerId ?? undefined },
  });
  const projectId = await ensureProjectIdForSubscription({
    userId,
    projectId: projectIdFromMetadata(stripeSub.metadata),
    stripeSubscriptionId: stripeSub.id,
  });
  const { start: periodStart, end: periodEnd } = subscriptionPeriodDates(stripeSub);
  const status = mapStripeStatus(stripeSub.status);
  try {
    const target = await findSubscriptionTargetRow({
      stripeSubscriptionId: stripeSub.id,
      userId,
      projectId,
    });
    const data = {
      planId: plan.id,
      status,
      billingCycle,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end),
      stripeSubscriptionId: stripeSub.id,
      stripeCustomerId: customerId,
      projectId,
    };
    if (target) {
      await prisma.subscription.update({ where: { id: target.id }, data });
    } else {
      await prisma.subscription.create({
        data: { userId, projectId, ...data },
      });
    }
  } catch (e) {
    logCheckout("sub_event_upsert_failed", { stripeSubId: stripeSub.id, userId, error: e?.message });
    throw e;
  }
  logCheckout("created_from_sub_event", {
    stripeSubId: stripeSub.id,
    userId,
    projectId,
    planCode: plan.code,
  });
}

export async function handleSubscriptionDeleted(stripeSub) {
  logCheckout("subscription_deleted_received", { stripeSubId: stripeSub.id });
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSub.id },
  });
  if (!sub) return;

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "canceled", canceledAt: new Date() },
  });

  const user = await prisma.user.findUnique({ where: { id: sub.userId } });
  if (user) {
    await sendTransactionalEmail({
      to: user.email,
      template: "subscription_canceled",
      idempotencyKey: `sub_cancel_${stripeSub.id}`,
      subject: "Subscription canceled",
      html: `<p>Hi ${user.name},</p><p>Your subscription has ended. We're sorry to see you go.</p>`,
    });
  }
  logCheckout("subscription_deleted_synced", { stripeSubId: stripeSub.id, userId: sub.userId });
}
