import { prisma } from "../db/client.mjs";
import { stripe } from "./stripeService.mjs";
import { log } from "../observability/logger.mjs";
import {
  assertRecurringAddonStripeStoreReady,
  findRecurringAddonStripeByStripeSubscriptionId,
} from "./recurringAddonStripeStore.mjs";
import { stripeSubscriptionIdOnInvoice } from "./stripeSubscriptionSync.mjs";

/** Human-readable invoice label for portal history (stored in `payments.invoice_number`). */
export function formatRecurringAddonInvoiceNumber(addonLabel, stripeInvoiceNumber) {
  const label = String(addonLabel ?? "Add-on").trim() || "Add-on";
  const num = String(stripeInvoiceNumber ?? "").trim() || "invoice";
  return `${label} (add-on) · ${num}`;
}

/**
 * Map a Stripe subscription id for a dedicated recurring add-on to the project's plan subscription row.
 */
export async function resolveRecurringAddonInvoiceTarget(stripeSubscriptionId) {
  const { row: addonRow } = await findRecurringAddonStripeByStripeSubscriptionId(stripeSubscriptionId);
  if (!addonRow) return null;

  const project = await prisma.project.findUnique({
    where: { id: addonRow.projectId },
    select: { ownerUserId: true },
  });
  if (!project?.ownerUserId) return null;

  const localSubscription = await prisma.subscription.findFirst({
    where: { userId: project.ownerUserId, projectId: addonRow.projectId },
    orderBy: { updatedAt: "desc" },
  });
  if (!localSubscription) return null;

  const addonCatalog = await prisma.subscriptionAddon.findUnique({
    where: { code: addonRow.addonCode },
    select: { label: true },
  });

  return {
    localSubscription,
    addonCode: addonRow.addonCode,
    addonLabel: addonCatalog?.label ?? addonRow.addonCode,
    projectId: addonRow.projectId,
  };
}

function paidAtFromInvoice(invoice) {
  return invoice.status_transitions?.paid_at != null
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : new Date();
}

/**
 * Record a Stripe invoice for a recurring add-on renewal against the project's plan subscription row.
 */
export async function upsertRecurringAddonInvoicePayment(invoice, target) {
  const invNum = formatRecurringAddonInvoiceNumber(
    target.addonLabel,
    invoice.number ?? String(invoice.id),
  );
  const pdfUrl = invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? null;
  const paidAt = paidAtFromInvoice(invoice);

  await prisma.payment.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      userId: target.localSubscription.userId,
      subscriptionId: target.localSubscription.id,
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
      invoiceNumber: invNum,
    },
  });

  return { invoiceNumber: invNum };
}

export async function upsertRecurringAddonFailedInvoicePayment(invoice, target) {
  const invNum = formatRecurringAddonInvoiceNumber(
    target.addonLabel,
    invoice.number ?? `failed_${invoice.id}`,
  );
  const pdfUrl = invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? null;

  await prisma.payment.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      userId: target.localSubscription.userId,
      subscriptionId: target.localSubscription.id,
      invoiceNumber: invNum,
      amountCents: invoice.amount_due ?? 0,
      currency: (invoice.currency ?? "usd").toUpperCase(),
      status: "failed",
      failureReason: invoice.last_finalization_error?.message ?? "add_on_payment_failed",
      stripeInvoiceId: invoice.id,
      invoicePdfUrl: pdfUrl,
    },
    update: {
      amountCents: invoice.amount_due ?? 0,
      currency: (invoice.currency ?? "usd").toUpperCase(),
      status: "failed",
      failureReason: invoice.last_finalization_error?.message ?? "add_on_payment_failed",
      invoicePdfUrl: pdfUrl,
      invoiceNumber: invNum,
    },
  });
}

async function collectInvoicesForStripeSubscription(stripeSubscriptionId) {
  const collected = new Map();
  let startingAfter;
  for (;;) {
    const page = await stripe.invoices.list({
      subscription: stripeSubscriptionId,
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
  return collected;
}

/** Backfill paid add-on renewal invoices for all dedicated add-on subs on a project. */
export async function syncRecurringAddonInvoicesFromStripe(userId, projectId) {
  if (!stripe) return { synced: 0 };

  const ready = assertRecurringAddonStripeStoreReady();
  if (!ready.ok) return { synced: 0, skipped: ready.message };

  const addonRows = await ready.delegate.findMany({ where: { projectId } });
  let synced = 0;

  for (const addonRow of addonRows) {
    const target = await resolveRecurringAddonInvoiceTarget(addonRow.stripeSubscriptionId);
    if (!target || target.localSubscription.userId !== userId) continue;

    const invoices = await collectInvoicesForStripeSubscription(addonRow.stripeSubscriptionId);
    for (const invoice of invoices.values()) {
      if (invoice.status !== "paid") continue;
      const paid = invoice.amount_paid ?? 0;
      if (paid <= 0) continue;
      await upsertRecurringAddonInvoicePayment(invoice, target);
      synced += 1;
    }
  }

  if (synced > 0) {
    log.info("subscription.addon_invoice_backfill.success", { userId, projectId, synced });
  }
  return { synced };
}
