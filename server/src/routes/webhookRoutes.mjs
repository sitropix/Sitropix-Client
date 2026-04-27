import express from "express";
import { prisma } from "../db/client.mjs";
import { assertStripeConfigured, stripe } from "../services/stripeService.mjs";
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "../services/stripeWebhookHandlers.mjs";
import { env } from "../config/env.mjs";
import { log } from "../observability/logger.mjs";
import { metricsWebhook } from "../observability/metrics.mjs";
import { sendAlert } from "../observability/alerts.mjs";
import { logAuditEvent } from "../services/auditLogService.mjs";

const router = express.Router();

router.post(
  "/stripe",
  // Must match Stripe's Content-Type; accept any so proxies / charsets do not drop the body.
  express.raw({ type: () => true, limit: "2mb" }),
  async (req, res) => {
  assertStripeConfigured();
  if (!env.stripeWebhookSecret?.trim()) {
    metricsWebhook.stripeMisconfig();
    log.warn("webhook.stripe_misconfigured", {
      hint: "STRIPE_WEBHOOK_SECRET is empty — set whsec_ from `npm run stripe:listen` or the Dashboard, then restart the API",
    });
    return res.status(503).send("webhook_not_configured");
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], env.stripeWebhookSecret);
  } catch (e) {
    metricsWebhook.stripeInvalidSig();
    log.warn("webhook.stripe_invalid_signature", {
      err: e?.message,
      bodyBytes: Buffer.isBuffer(req.body) ? req.body.length : 0,
      hasSig: Boolean(req.headers["stripe-signature"]),
    });
    return res.status(400).send("invalid_signature");
  }

  const existing = await prisma.webhookEvent.findUnique({ where: { eventId: event.id } });
  if (existing?.processedAt) {
    metricsWebhook.stripeDedup();
    return res.json({ ok: true, deduped: true });
  }

  if (!existing) {
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: "stripe",
          eventId: event.id,
          eventType: event.type,
          payload: event.data.object,
        },
      });
    } catch (e) {
      // Concurrent duplicate delivery — treat as safe to process if not yet marked done.
      if (e?.code !== "P2002") throw e;
    }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        // Delegate to handler — it skips non-subscription sessions; do not gate on `mode` here
        // (some API versions/payloads omit `mode` and would otherwise never sync).
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.created":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;
      default:
        break;
    }
  } catch (e) {
    metricsWebhook.stripeHandlerFail();
    log.error("webhook.stripe_handler_failed", {
      requestId: req.requestId,
      type: event.type,
      error: e?.message,
    });
    void sendAlert({
      event: "webhook.stripe_handler_failed",
      requestId: req.requestId,
      detail: { eventType: event.type, error: e?.message },
    });
    // Leave processedAt null so Stripe retries; do not swallow as 200.
    return res.status(500).json({ error: "webhook_handler_failed" });
  }

  await prisma.webhookEvent.updateMany({
    where: { eventId: event.id },
    data: { processedAt: new Date() },
  });
  metricsWebhook.stripeOk();
  await logAuditEvent({
    action: "billing.webhook_processed",
    targetType: "webhook_event",
    targetId: event.id,
    metadata: { provider: "stripe", eventType: event.type },
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
    requestId: req.requestId ?? req.headers["x-request-id"] ?? null,
  });

  return res.json({ ok: true });
  },
);

/** Razorpay webhook — verify signature from the exact raw body bytes. */
router.post("/razorpay", express.raw({ type: () => true, limit: "1mb" }), async (req, res) => {
  if (!env.razorpayWebhookSecret) return res.status(501).json({ error: "razorpay_not_configured" });

  const crypto = await import("node:crypto");
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? "");
  const expected = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(rawBody).digest("hex");
  const sig = req.headers["x-razorpay-signature"];
  if (sig !== expected) {
    return res.status(400).json({ error: "invalid_signature" });
  }
  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const eventId = payload?.event?.id ?? payload?.id ?? `rp_${Date.now()}`;
  const existing = await prisma.webhookEvent.findUnique({ where: { eventId } });
  if (existing) return res.json({ ok: true, deduped: true });

  await prisma.webhookEvent.create({
    data: {
      provider: "razorpay",
      eventId,
      eventType: payload?.event ?? "unknown",
      payload,
      processedAt: new Date(),
    },
  });

  metricsWebhook.razorpay();
  return res.json({ ok: true, note: "razorpay_events_logged_extend_as_needed" });
});

export { router as webhookRouter };
