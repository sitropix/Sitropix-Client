import { prisma } from "../db/client.mjs";
import { assertStripeConfigured, stripe } from "./stripeService.mjs";
import {
  mapStripeStatus,
  persistStripeIdsOnPlanIfMissing,
  resolvePlanAndBillingCycle,
  stripePriceIdFromSubscriptionObject,
  subscriptionPeriodDates,
} from "./stripeSyncHelpers.mjs";
import { log } from "../observability/logger.mjs";

/**
 * Reconcile the DB from Stripe (REST pull). Use when webhooks are not received
 * (missing STRIPE_WEBHOOK_SECRET, wrong port, etc.).
 *
 * `options.projectId` (optional) restricts the upsert to a specific (user, project) row.
 *  - When provided we prefer the matching Stripe subscription whose metadata.projectId matches.
 *  - When omitted we resolve project from Stripe metadata, an existing DB row for this Stripe sub,
 *    or the user's latest project. Never auto-creates a project (users create projects in-app).
 */
export async function syncSubscriptionFromStripeForUserId(userId, options = {}) {
  const targetProjectId = options.projectId ?? null;
  log.info("subscription.sync_pull.start", { userId, projectId: targetProjectId });
  try {
    assertStripeConfigured();
  } catch {
    return { ok: false, reason: "stripe_not_configured" };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    log.warn("subscription.sync_pull.user_not_found", { userId });
    return { ok: false, reason: "user_not_found" };
  }

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const { data: customers } = await stripe.customers.list({ email: user.email, limit: 8 });
    const lower = user.email.toLowerCase();
    const match =
      customers.find((c) => c.email?.toLowerCase() === lower) ?? (customers.length > 0 ? customers[0] : null);
    if (!match) {
      log.info("subscription.sync_pull.no_customer", { userId, email: user.email });
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

  const isLive = (s) => s.status === "active" || s.status === "trialing" || s.status === "past_due";
  const matchProject = (s) => (s.metadata?.projectId ?? null) === targetProjectId;
  const candidates = subRows ?? [];

  let best = null;
  if (targetProjectId) {
    // Prefer a Stripe sub whose metadata projectId matches.
    const projectMatched = candidates.filter(matchProject);
    const scored = projectMatched.map((s) => ({ s, score: isLive(s) ? 1 : 0, created: s.created }));
    scored.sort((a, b) => (b.score - a.score) || (b.created - a.created));
    best = scored[0]?.s ?? null;
  }
  if (!best) {
    const scored = candidates.map((s) => ({ s, score: isLive(s) ? 1 : 0, created: s.created }));
    scored.sort((a, b) => (b.score - a.score) || (b.created - a.created));
    best = scored[0]?.s ?? null;
  }
  if (!best) {
    log.info("subscription.sync_pull.no_subscription", { userId, customerId });
    return { ok: false, reason: "no_stripe_subscription" };
  }

  const full = await stripe.subscriptions.retrieve(best.id, { expand: ["items.data.price"] });
  const priceId = stripePriceIdFromSubscriptionObject(full);
  const { plan, billingCycle } = await resolvePlanAndBillingCycle(priceId);
  if (!plan) {
    log.warn("subscription.sync_pull.plan_unmapped", { userId, stripeSubscriptionId: full.id, priceId });
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
  const projectIdFromMeta = typeof full.metadata?.projectId === "string" && full.metadata.projectId.trim()
    ? full.metadata.projectId.trim()
    : null;
  async function ensureProjectId() {
    // Never trust Stripe metadata (or a stale client projectId) without an FK check — invalid
    // ids cause `subscriptions_project_id_fkey` on create/update.
    for (const raw of [targetProjectId, projectIdFromMeta]) {
      if (!raw) continue;
      const owned = await prisma.project.findFirst({
        where: { id: raw, ownerUserId: userId },
        select: { id: true },
      });
      if (owned?.id) return owned.id;
      log.warn("subscription.sync_pull.project_id_ignored", {
        userId,
        projectId: raw,
        source: raw === targetProjectId ? "request" : "stripe_metadata",
      });
    }
    const existing = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: full.id, userId },
      select: { projectId: true },
    });
    if (existing?.projectId) return existing.projectId;
    const latestProject = await prisma.project.findFirst({
      where: { ownerUserId: userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (latestProject?.id) return latestProject.id;
    return null;
  }
  const resolvedProjectId = await ensureProjectId();
  if (!resolvedProjectId) {
    log.info("subscription.sync_pull.no_project", { userId, stripeSubscriptionId: full.id });
    return { ok: false, reason: "no_project" };
  }

  // Upsert by stripeSubscriptionId first (catches a row that already exists in another
  // project slot for the same user) then fall back to (userId, projectId).
  const localStatus = mapStripeStatus(full);
  const pausedAt = localStatus === "paused" ? new Date() : null;
  const data = {
    planId: plan.id,
    status: localStatus,
    billingCycle,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: Boolean(full.cancel_at_period_end),
    pausedAt,
    stripeSubscriptionId: full.id,
    stripeCustomerId: customerId,
    projectId: resolvedProjectId,
  };

  const existingByStripe = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: full.id },
  });
  let savedRow;
  if (existingByStripe) {
    savedRow = await prisma.subscription.update({ where: { id: existingByStripe.id }, data });
  } else {
    const existingForPair = await prisma.subscription.findFirst({
      where: { userId, projectId: resolvedProjectId },
    });
    if (existingForPair) {
      savedRow = await prisma.subscription.update({ where: { id: existingForPair.id }, data });
    } else {
      savedRow = await prisma.subscription.create({
        data: { userId, projectId: resolvedProjectId, ...data },
      });
    }
  }

  if (savedRow) {
    await syncPaidInvoicesFromStripe(userId, savedRow.id, full.id, customerId);
  }

  log.info("subscription.sync_pull.success", {
    userId,
    projectId: resolvedProjectId,
    planId: plan.id,
    planCode: plan.code,
    stripeSubscriptionId: full.id,
    customerId,
  });
  return { ok: true, planCode: plan.code, stripeSubscriptionId: full.id, projectId: resolvedProjectId };
}

/**
 * Resolve Stripe customer id for billing flows (add-on checkout, portal).
 * Prefers subscription row, then user, then Stripe subscription / customer list; backfills DB.
 * @param {string} userId
 * @param {{ id: string; stripeCustomerId?: string | null; stripeSubscriptionId?: string | null }} subscriptionRow
 */
export async function resolveStripeCustomerIdForSubscription(userId, subscriptionRow) {
  if (!subscriptionRow?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true },
  });

  let customerId = subscriptionRow.stripeCustomerId ?? user?.stripeCustomerId ?? null;

  async function persistCustomerId(cid) {
    if (!cid) return;
    if (subscriptionRow.stripeCustomerId !== cid) {
      await prisma.subscription.update({
        where: { id: subscriptionRow.id },
        data: { stripeCustomerId: cid },
      });
    }
    if (user && user.stripeCustomerId !== cid) {
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: cid },
      });
    }
    customerId = cid;
  }

  if (customerId) {
    await persistCustomerId(customerId);
    return customerId;
  }

  if (subscriptionRow.stripeSubscriptionId && stripe) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(subscriptionRow.stripeSubscriptionId);
      const raw = stripeSub.customer;
      const cid = typeof raw === "string" ? raw : raw?.id ?? null;
      if (cid) {
        await persistCustomerId(cid);
        return customerId;
      }
    } catch (e) {
      log.warn("subscription.resolve_customer.stripe_sub_failed", {
        userId,
        subscriptionId: subscriptionRow.id,
        error: e?.message,
      });
    }
  }

  if (user?.email && stripe) {
    try {
      const { data: customers } = await stripe.customers.list({ email: user.email, limit: 8 });
      const lower = user.email.toLowerCase();
      const match =
        customers.find((c) => c.email?.toLowerCase() === lower) ?? (customers.length > 0 ? customers[0] : null);
      if (match?.id) {
        await persistCustomerId(match.id);
        return customerId;
      }
    } catch (e) {
      log.warn("subscription.resolve_customer.list_failed", { userId, error: e?.message });
    }
  }

  return null;
}

function stripeSubscriptionIdOnInvoice(invoice) {
  // Try the direct subscription field (older API versions)
  const sub = invoice.subscription;
  if (typeof sub === "string") return sub;
  if (sub?.id) return sub.id;
  
  // Newer Stripe API: subscription ID is in line item parent details
  const lines = invoice.lines?.data ?? [];
  for (const line of lines) {
    const subIdFromParent = line.parent?.subscription_item_details?.subscription;
    if (subIdFromParent) return subIdFromParent;
    // Also check legacy line.subscription field
    if (line.subscription) {
      return typeof line.subscription === "string" ? line.subscription : line.subscription?.id;
    }
  }
  
  return null;
}

/** Backfill payments from Stripe invoices when webhooks did not run. */
export async function syncPaidInvoicesFromStripe(userId, subscriptionRowId, stripeSubscriptionId, stripeCustomerId = null) {
  if (!stripe) return;
  log.info("subscription.invoice_backfill.start", { userId, subscriptionRowId, stripeSubscriptionId, hasCustomerId: Boolean(stripeCustomerId) });

  const subRow =
    (await prisma.subscription.findUnique({ where: { id: subscriptionRowId } })) ??
    (await prisma.subscription.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } }));
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
  log.info("subscription.invoice_backfill.success", {
    userId,
    subscriptionRowId,
    stripeSubscriptionId,
    invoiceCount: collected.size,
  });
}
