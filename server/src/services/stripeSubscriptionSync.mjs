import { prisma } from "../db/client.mjs";
import { assertStripeConfigured, stripe } from "./stripeService.mjs";
import {
  mapStripeStatus,
  persistStripeIdsOnPlanIfMissing,
  resolvePlanAndBillingCycle,
  stripePriceIdFromSubscriptionObject,
  subscriptionPeriodDates,
} from "./stripeSyncHelpers.mjs";

/**
 * Reconcile the DB from Stripe (REST pull). Use when webhooks are not received
 * (missing STRIPE_WEBHOOK_SECRET, wrong port, etc.).
 */
export async function syncSubscriptionFromStripeForUserId(userId) {
  try {
    assertStripeConfigured();
  } catch {
    return { ok: false, reason: "stripe_not_configured" };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const { data: customers } = await stripe.customers.list({ email: user.email, limit: 8 });
    const lower = user.email.toLowerCase();
    const match =
      customers.find((c) => c.email?.toLowerCase() === lower) ?? (customers.length > 0 ? customers[0] : null);
    if (!match) {
      return { ok: false, reason: "no_stripe_customer" };
    }
    customerId = match.id;
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }

  const { data: subRows } = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });

  const prefer = (a, b) => b - a;
  const scored = (subRows ?? []).map((s) => {
    const good = s.status === "active" || s.status === "trialing" || s.status === "past_due";
    return { s, score: good ? 1 : 0, created: s.created };
  });
  scored.sort((a, b) => (b.score - a.score) || prefer(a.created, b.created));
  const best = scored[0]?.s;
  if (!best) {
    return { ok: false, reason: "no_stripe_subscription" };
  }

  const full = await stripe.subscriptions.retrieve(best.id, { expand: ["items.data.price"] });
  const priceId = stripePriceIdFromSubscriptionObject(full);
  const { plan, billingCycle } = await resolvePlanAndBillingCycle(priceId);
  if (!plan) {
    return { ok: false, reason: "plan_not_mapped", detail: { priceId } };
  }

  if (priceId) {
    try {
      const pr = await stripe.prices.retrieve(priceId);
      const po = pr.product;
      const productId = typeof po === "string" ? po : po?.id ?? null;
      await persistStripeIdsOnPlanIfMissing(plan.id, { priceId, billingCycle, productId });
    } catch {
      /* non-fatal */
    }
  }

  const { start: periodStart, end: periodEnd } = subscriptionPeriodDates(full);

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planId: plan.id,
      status: mapStripeStatus(full.status),
      billingCycle,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      stripeSubscriptionId: full.id,
      stripeCustomerId: customerId,
    },
    update: {
      planId: plan.id,
      status: mapStripeStatus(full.status),
      billingCycle,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      stripeSubscriptionId: full.id,
      stripeCustomerId: customerId,
    },
  });

  const subRow = await prisma.subscription.findUnique({ where: { userId } });
  if (subRow) {
    await syncPaidInvoicesFromStripe(userId, subRow.id, full.id, customerId);
  }

  return { ok: true, planCode: plan.code, stripeSubscriptionId: full.id };
}

function stripeSubscriptionIdOnInvoice(invoice) {
  const sub = invoice.subscription;
  return typeof sub === "string" ? sub : sub?.id ?? null;
}

/** Backfill payments from Stripe invoices when webhooks did not run. */
export async function syncPaidInvoicesFromStripe(userId, subscriptionRowId, stripeSubscriptionId, stripeCustomerId = null) {
  if (!stripe) return;

  const subRow =
    (await prisma.subscription.findUnique({ where: { id: subscriptionRowId } })) ??
    (await prisma.subscription.findUnique({ where: { userId } }));
  const customerId = stripeCustomerId ?? subRow?.stripeCustomerId ?? null;

  const collected = new Map();

  async function collectPages(listParams) {
    let startingAfter;
    for (;;) {
      const page = await stripe.invoices.list({
        ...listParams,
        limit: 40,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const invoice of page.data) {
        const sid = stripeSubscriptionIdOnInvoice(invoice);
        if (sid !== stripeSubscriptionId) continue;
        collected.set(invoice.id, invoice);
      }
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
  }

  await collectPages({ subscription: stripeSubscriptionId });
  if (collected.size === 0 && customerId) {
    await collectPages({ customer: customerId });
  }

  for (const invoice of collected.values()) {
    const invNum = invoice.number ?? String(invoice.id);
    const pdfUrl = invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? null;

    if (invoice.status === "paid") {
      const paid = invoice.amount_paid ?? 0;
      if (paid <= 0) continue;
      const paidAt = invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : new Date();
      await prisma.payment.upsert({
        where: { stripeInvoiceId: invoice.id },
        create: {
          userId,
          subscriptionId: subscriptionRowId,
          invoiceNumber: invNum,
          amountCents: paid,
          currency: (invoice.currency ?? "usd").toUpperCase(),
          status: "succeeded",
          paidAt,
          stripeInvoiceId: invoice.id,
          invoicePdfUrl: pdfUrl,
        },
        update: {
          userId,
          subscriptionId: subscriptionRowId,
          amountCents: paid,
          status: "succeeded",
          paidAt,
          invoicePdfUrl: pdfUrl,
        },
      });
      continue;
    }

    if (invoice.status === "open" || invoice.status === "draft") {
      const due = invoice.amount_due ?? invoice.total ?? 0;
      await prisma.payment.upsert({
        where: { stripeInvoiceId: invoice.id },
        create: {
          userId,
          subscriptionId: subscriptionRowId,
          invoiceNumber: invNum,
          amountCents: due,
          currency: (invoice.currency ?? "usd").toUpperCase(),
          status: "pending",
          paidAt: null,
          stripeInvoiceId: invoice.id,
          invoicePdfUrl: pdfUrl,
        },
        update: {
          userId,
          subscriptionId: subscriptionRowId,
          amountCents: due,
          status: "pending",
          paidAt: null,
          invoicePdfUrl: pdfUrl,
        },
      });
      continue;
    }

    if (invoice.status === "uncollectible") {
      await prisma.payment.upsert({
        where: { stripeInvoiceId: invoice.id },
        create: {
          userId,
          subscriptionId: subscriptionRowId,
          invoiceNumber: invNum,
          amountCents: invoice.amount_due ?? invoice.total ?? 0,
          currency: (invoice.currency ?? "usd").toUpperCase(),
          status: "failed",
          failureReason: "uncollectible",
          stripeInvoiceId: invoice.id,
          invoicePdfUrl: pdfUrl,
        },
        update: {
          userId,
          subscriptionId: subscriptionRowId,
          amountCents: invoice.amount_due ?? invoice.total ?? 0,
          status: "failed",
          failureReason: "uncollectible",
          invoicePdfUrl: pdfUrl,
        },
      });
    }
  }
}
