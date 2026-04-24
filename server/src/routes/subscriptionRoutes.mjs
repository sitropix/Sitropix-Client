import express from "express";
import { prisma } from "../db/client.mjs";
import { env } from "../config/env.mjs";
import { requireAuth, requireRole } from "../middleware/auth.mjs";
import { validate } from "../middleware/validate.mjs";
import { couponSchema, paymentMethodSchema, planPatchSchema, planSchema } from "../schemas/billingSchemas.mjs";
import { createInviteSchema } from "../schemas/inviteSchemas.mjs";
import { emailSettingsPutSchema, emailTestSchema } from "../schemas/emailSettingsSchemas.mjs";
import { getAdminEmailSettingsPayload, saveAdminEmailSettings } from "../services/emailSettingsStore.mjs";
import { sendTransactionalEmail } from "../services/emailService.mjs";
import { assertStripeConfigured, stripe } from "../services/stripeService.mjs";
import { syncSubscriptionFromStripeForUserId } from "../services/stripeSubscriptionSync.mjs";
import { logAuditEvent, requestAuditContext } from "../services/auditLogService.mjs";
import {
  ensureFeatureFlagDefaults,
  listFeatureFlagsForAdmin,
  resolveSubscriptionFeatureControls,
} from "../services/featureFlagService.mjs";
import { randomToken, sha256 } from "../utils/crypto.mjs";

const router = express.Router();
router.use(requireAuth);

/** Pull subscription from Stripe into the DB (works without webhooks). Always 200 + JSON so the client can ignore soft failures. */
router.post("/sync-stripe", async (req, res) => {
  try {
    const out = await syncSubscriptionFromStripeForUserId(req.auth.userId);
    return res.json(out);
  } catch (e) {
    const msg = e?.message ?? String(e);
    if (msg.includes("stripe_not_configured")) {
      return res.json({ ok: false, reason: "stripe_not_configured" });
    }
    return res.json({ ok: false, reason: "sync_failed", error: msg });
  }
});

function mapPlan(p) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    priceMonthlyCents: p.priceMonthlyCents,
    priceYearlyCents: p.priceYearlyCents,
    currency: p.currency,
    features: p.features,
    isActive: p.isActive,
    trialDays: p.trialDays,
  };
}

/** Cards attached to the Stripe customer (Checkout attaches the card here). */
async function stripeCardPaymentMethodsForCustomer(customerId, userId) {
  if (!stripe || !customerId) return [];
  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if ("deleted" in customer && customer.deleted) return [];
    const def = customer.invoice_settings?.default_payment_method;
    const defaultId =
      typeof def === "string" ? def : def && typeof def === "object" && "id" in def ? def.id : null;

    const [cardList, linkList] = await Promise.all([
      stripe.paymentMethods.list({ customer: customerId, type: "card" }),
      stripe.paymentMethods.list({ customer: customerId, type: "link" }),
    ]);
    const rows = [];
    for (const pm of cardList.data) {
      rows.push({
        id: pm.id,
        userId,
        brand: String(pm.card?.display_brand ?? pm.card?.brand ?? "card"),
        last4: pm.card?.last4 ?? "????",
        expMonth: pm.card?.exp_month ?? 0,
        expYear: pm.card?.exp_year ?? 0,
        isDefault: Boolean(defaultId && pm.id === defaultId),
      });
    }
    for (const pm of linkList.data) {
      rows.push({
        id: pm.id,
        userId,
        brand: "Link",
        last4: pm.link?.email ? String(pm.link.email).slice(-4) : "••••",
        expMonth: 0,
        expYear: 0,
        isDefault: Boolean(defaultId && pm.id === defaultId),
      });
    }
    if (rows.length === 0) return [];
    if (!rows.some((r) => r.isDefault)) rows[0].isDefault = true;
    return rows;
  } catch (e) {
    console.warn(JSON.stringify({ level: "warn", msg: "portal.stripe_payment_methods_failed", error: e?.message }));
    return [];
  }
}

/** Fill missing PDF/hosted URLs from Stripe so the billing page can open invoices. */
async function hydrateInvoicePdfUrls(payments) {
  if (!stripe) return payments;
  return Promise.all(
    payments.map(async (p) => {
      if (p.invoicePdfUrl || !p.stripeInvoiceId) return p;
      try {
        const inv = await stripe.invoices.retrieve(p.stripeInvoiceId);
        const url = inv.invoice_pdf ?? inv.hosted_invoice_url ?? null;
        if (url) {
          await prisma.payment.update({ where: { id: p.id }, data: { invoicePdfUrl: url } }).catch(() => {});
          return { ...p, invoicePdfUrl: url };
        }
      } catch {
        /* ignore */
      }
      return p;
    }),
  );
}

router.get("/portal", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  const [plans, subscription, payments] = await Promise.all([
    prisma.plan.findMany({ where: { isActive: true, archivedAt: null }, orderBy: { priceMonthlyCents: "asc" } }),
    prisma.subscription.findUnique({
      where: { userId: req.auth.userId },
      include: { plan: true },
    }),
    prisma.payment.findMany({
      where: { userId: req.auth.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const customerId = user?.stripeCustomerId ?? subscription?.stripeCustomerId ?? null;
  const [paymentMethods, paymentsHydrated] = await Promise.all([
    stripeCardPaymentMethodsForCustomer(customerId, req.auth.userId),
    hydrateInvoicePdfUrls(payments),
  ]);

  const portalSubscription =
    subscription && subscription.status !== "canceled"
      ? {
          id: subscription.id,
          userId: subscription.userId,
          planId: subscription.planId,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          pausedAt: subscription.pausedAt,
          canceledAt: subscription.canceledAt,
          nextBillingDate: subscription.currentPeriodEnd,
          plan: subscription.plan ? mapPlan(subscription.plan) : undefined,
        }
      : null;

  const featureControls = await resolveSubscriptionFeatureControls(portalSubscription?.planId ?? null);

  return res.json({
    user: {
      id: req.auth.userId,
      email: req.auth.email,
      name: user?.name ?? req.auth.name,
      role: req.auth.role,
    },
    plans: plans.map(mapPlan),
    subscription: portalSubscription,
    featureControls,
    invoices: paymentsHydrated.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      amountCents: i.amountCents,
      currency: i.currency,
      status: i.status,
      paidAt: i.paidAt,
      failureReason: i.failureReason,
      invoicePdfUrl: i.invoicePdfUrl,
    })),
    paymentMethods,
  });
});

router.post("/bootstrap", async (req, res) => {
  if (process.env.ALLOW_DEV_TRIAL !== "true") {
    return res.status(400).json({ error: "use_stripe_checkout", message: "Complete subscription via Stripe Checkout." });
  }
  const { planId, billingCycle = "monthly" } = req.body ?? {};
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return res.status(404).json({ error: "plan_not_found" });
  const existing = await prisma.subscription.findUnique({ where: { userId: req.auth.userId } });
  if (existing) return res.json(existing);
  const now = new Date();
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + (billingCycle === "yearly" ? 365 : 30));
  const sub = await prisma.subscription.create({
    data: {
      userId: req.auth.userId,
      planId: plan.id,
      status: "trialing",
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: end,
    },
  });
  return res.status(201).json(sub);
});

router.post("/change-plan", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const { planId, billingCycle } = req.body ?? {};
  const sub = await prisma.subscription.findUnique({
    where: { userId: req.auth.userId },
    include: { plan: true },
  });
  const nextPlan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!sub || !nextPlan) return res.status(404).json({ error: "subscription_or_plan_not_found" });

  const cycle = billingCycle ?? sub.billingCycle;
  const currentCost = cycle === "yearly" ? sub.plan.priceYearlyCents : sub.plan.priceMonthlyCents;
  const nextCost = cycle === "yearly" ? nextPlan.priceYearlyCents : nextPlan.priceMonthlyCents;
  const netCents = nextCost - currentCost;

  if (stripe && sub.stripeSubscriptionId && nextPlan.stripePriceMonthlyId && nextPlan.stripePriceYearlyId) {
    const newPriceId = cycle === "yearly" ? nextPlan.stripePriceYearlyId : nextPlan.stripePriceMonthlyId;
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: stripeSub.items.data[0].id, price: newPriceId }],
      proration_behavior: "create_prorations",
    });
  }

  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { planId: nextPlan.id, billingCycle: cycle },
    include: { plan: true },
  });
  await logAuditEvent({
    action: "subscription.plan_changed",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "subscription",
    targetId: updated.id,
    metadata: { previousPlanId: sub.planId, nextPlanId: nextPlan.id, billingCycle: cycle, netCents },
    ...auditCtx,
  });

  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (user) {
    await sendTransactionalEmail({
      to: user.email,
      template: "plan_changed",
      idempotencyKey: `plan_change_${sub.id}_${Date.now()}`,
      subject: "Your plan was updated",
      html: `<p>Hi ${user.name},</p><p>Your plan is now <strong>${nextPlan.name}</strong>.</p>`,
    });
  }

  return res.json({ subscription: updated, proration: { netCents } });
});

router.post("/cancel", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const sub = await prisma.subscription.findUnique({ where: { userId: req.auth.userId } });
  if (!sub) return res.status(404).json({ error: "subscription_not_found" });
  if (sub.status === "canceled") return res.status(400).json({ error: "already_canceled" });
  const fc = await resolveSubscriptionFeatureControls(sub.planId);
  if (!fc.selfCancel) return res.status(403).json({ error: "feature_disabled" });

  if (stripe && sub.stripeSubscriptionId) {
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
  }

  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      cancelAtPeriodEnd: false,
      status: "canceled",
      canceledAt: new Date(),
      pausedAt: null,
    },
  });
  await logAuditEvent({
    action: "subscription.canceled_by_user",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "subscription",
    targetId: updated.id,
    metadata: { planId: updated.planId },
    ...auditCtx,
  });

  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (user) {
    await sendTransactionalEmail({
      to: user.email,
      template: "subscription_canceled",
      idempotencyKey: `user_cancel_${sub.id}`,
      subject: "Subscription canceled",
      html: `<p>Hi ${user.name},</p><p>Your subscription has been canceled per your request.</p>`,
    });
  }

  return res.json(updated);
});

router.post("/pause", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const sub = await prisma.subscription.findUnique({ where: { userId: req.auth.userId } });
  if (!sub) return res.status(404).json({ error: "subscription_not_found" });
  if (sub.status === "canceled") return res.status(400).json({ error: "subscription_canceled" });
  if (sub.status === "paused") return res.status(400).json({ error: "already_paused" });
  if (!["active", "trialing", "past_due"].includes(sub.status)) {
    return res.status(400).json({ error: "cannot_pause_in_current_state" });
  }
  const fcPause = await resolveSubscriptionFeatureControls(sub.planId);
  if (!fcPause.pauseResume) return res.status(403).json({ error: "feature_disabled" });
  if (stripe && sub.stripeSubscriptionId) {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { pause_collection: { behavior: "void" } });
  }
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "paused", pausedAt: new Date() },
  });
  await logAuditEvent({
    action: "subscription.paused_by_user",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "subscription",
    targetId: updated.id,
    metadata: { planId: updated.planId },
    ...auditCtx,
  });
  return res.json(updated);
});

router.post("/resume", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const sub = await prisma.subscription.findUnique({ where: { userId: req.auth.userId } });
  if (!sub) return res.status(404).json({ error: "subscription_not_found" });
  if (sub.status !== "paused") return res.status(400).json({ error: "not_paused" });
  const fcResume = await resolveSubscriptionFeatureControls(sub.planId);
  if (!fcResume.pauseResume) return res.status(403).json({ error: "feature_disabled" });
  if (stripe && sub.stripeSubscriptionId) {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { pause_collection: null });
  }
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "active", pausedAt: null },
  });
  await logAuditEvent({
    action: "subscription.resumed_by_user",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "subscription",
    targetId: updated.id,
    metadata: { planId: updated.planId },
    ...auditCtx,
  });
  return res.json(updated);
});

router.post("/payment-method", validate(paymentMethodSchema), async (req, res) => {
  return res.json({ ok: true, message: "use_stripe_billing_portal_for_cards", last4: req.validatedBody.last4 });
});

router.post("/checkout-session", async (req, res) => {
  assertStripeConfigured();
  const { planId, billingCycle = "monthly" } = req.body ?? {};
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return res.status(404).json({ error: "plan_not_found" });
  const stripePriceId = billingCycle === "yearly" ? plan.stripePriceYearlyId : plan.stripePriceMonthlyId;
  if (!stripePriceId) return res.status(400).json({ error: "missing_stripe_price_mapping" });
  const successUrl = req.body.successUrl ?? env.stripeSuccessUrl;
  const cancelUrl = req.body.cancelUrl ?? env.stripeCancelUrl;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: req.auth.userId,
    customer_email: req.auth.email,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId: req.auth.userId, planId: plan.id, billingCycle },
    subscription_data: {
      metadata: { userId: req.auth.userId, planId: plan.id, billingCycle },
    },
  });
  return res.json({ url: session.url });
});

router.post("/billing-portal", async (req, res) => {
  assertStripeConfigured();
  const sub = await prisma.subscription.findUnique({ where: { userId: req.auth.userId } });
  if (!sub?.stripeCustomerId) return res.status(400).json({ error: "missing_stripe_customer" });
  const returnUrl = req.body.returnUrl ?? `${env.appUrl}/billing`;
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: returnUrl,
  });
  return res.json({ url: session.url });
});

/* ------------- Admin ------------- */
const adminRouter = express.Router();
adminRouter.use(requireAuth, requireRole("admin"));

adminRouter.get("/plans", async (_req, res) => {
  const plans = await prisma.plan.findMany({ orderBy: { createdAt: "desc" } });
  return res.json(plans);
});

adminRouter.post("/plans", validate(planSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const p = req.validatedBody;
  const created = await prisma.plan.create({
    data: {
      code: p.code,
      name: p.name,
      description: p.description ?? "",
      priceMonthlyCents: p.priceMonthlyCents,
      priceYearlyCents: p.priceYearlyCents,
      currency: p.currency ?? "USD",
      features: p.features ?? [],
      isActive: p.isActive ?? true,
      trialDays: p.trialDays ?? 14,
    },
  });
  await logAuditEvent({
    action: "admin.plan_created",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "plan",
    targetId: created.id,
    metadata: { code: created.code, monthly: created.priceMonthlyCents, yearly: created.priceYearlyCents },
    ...auditCtx,
  });
  return res.status(201).json(created);
});

adminRouter.patch("/plans/:id", validate(planPatchSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const updated = await prisma.plan.update({ where: { id: req.params.id }, data: req.validatedBody });
  await logAuditEvent({
    action: "admin.plan_updated",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "plan",
    targetId: updated.id,
    metadata: { patchKeys: Object.keys(req.validatedBody ?? {}) },
    ...auditCtx,
  });
  return res.json(updated);
});

adminRouter.delete("/plans/:id", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  await prisma.plan.update({ where: { id: req.params.id }, data: { archivedAt: new Date(), isActive: false } });
  await logAuditEvent({
    action: "admin.plan_archived",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "plan",
    targetId: req.params.id,
    ...auditCtx,
  });
  return res.json({ ok: true });
});

adminRouter.post("/invites", validate(createInviteSchema), async (req, res) => {
  const { email, planId, message, expiresInDays } = req.validatedBody;
  const emailLower = email.toLowerCase();
  if (planId) {
    const p = await prisma.plan.findUnique({ where: { id: planId } });
    if (!p) return res.status(400).json({ error: "plan_not_found" });
  }
  const days = expiresInDays ?? 14;
  const plainToken = randomToken(32);
  const invite = await prisma.invite.create({
    data: {
      email: emailLower,
      tokenHash: sha256(plainToken),
      planId: planId ?? null,
      message: (message ?? "").trim().slice(0, 4000),
      expiresAt: new Date(Date.now() + days * 864e5),
      createdByUserId: req.auth.userId,
    },
    include: { plan: { select: { name: true, code: true } } },
  });
  const signupUrl = `${env.appUrl}/signup?invite=${encodeURIComponent(plainToken)}`;
  const msgHtml = invite.message
    ? `<div style="margin:16px 0;padding:12px;border-radius:8px;background:#111;color:#eee;">${invite.message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>")}</div>`
    : "";
  const planLine = invite.plan ? `<p>Your workspace includes the <strong>${invite.plan.name}</strong> plan.</p>` : "";
  await sendTransactionalEmail({
    to: emailLower,
    template: "invite",
    idempotencyKey: `invite_${invite.id}`,
    subject: "You are invited to Sitropix",
    html: `<p>You have been invited to create an account.</p>${msgHtml}${planLine}<p><a href="${signupUrl}">Accept invitation</a></p><p>This link expires in ${days} days.</p>`,
  });
  return res.status(201).json({ ok: true, id: invite.id, email: emailLower, expiresAt: invite.expiresAt });
});

adminRouter.get("/invites", async (_req, res) => {
  const rows = await prisma.invite.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      plan: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  return res.json(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      planId: r.planId,
      plan: r.plan,
      message: r.message,
      expiresAt: r.expiresAt,
      acceptedAt: r.acceptedAt,
      revokedAt: r.revokedAt,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
    })),
  );
});

adminRouter.delete("/invites/:id", async (req, res) => {
  const row = await prisma.invite.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.acceptedAt) return res.status(400).json({ error: "already_accepted" });
  await prisma.invite.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  return res.json({ ok: true });
});

adminRouter.get("/customers", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { subscriptions: { include: { plan: true } } },
    take: 200,
  });
  return res.json(users);
});

adminRouter.get("/subscriptions", async (req, res) => {
  const status = req.query.status;
  const where = status ? { status } : {};
  const rows = await prisma.subscription.findMany({
    where,
    include: { plan: true, user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return res.json(rows);
});

adminRouter.patch("/subscriptions/:id", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const body = req.body ?? {};
  const data = { ...body };
  if (typeof data.extendDays === "number" && data.extendDays > 0) {
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (sub) {
      const end = new Date(sub.currentPeriodEnd);
      end.setUTCDate(end.getUTCDate() + data.extendDays);
      data.currentPeriodEnd = end;
    }
    delete data.extendDays;
  }
  const updated = await prisma.subscription.update({ where: { id: req.params.id }, data, include: { plan: true, user: { select: { id: true, email: true, name: true } } } });
  await logAuditEvent({
    action: "admin.subscription_updated",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "subscription",
    targetId: updated.id,
    metadata: { patchKeys: Object.keys(body ?? {}), resultingStatus: updated.status },
    ...auditCtx,
  });
  return res.json(updated);
});

adminRouter.post("/coupons", validate(couponSchema), async (req, res) => {
  const c = req.validatedBody;
  const created = await prisma.coupon.create({
    data: {
      code: c.code.toUpperCase(),
      discountType: c.discountType,
      discountValue: Math.round(c.discountValue),
      maxRedemptions: c.maxRedemptions,
      expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
    },
  });
  return res.status(201).json(created);
});

adminRouter.get("/coupons", async (_req, res) => {
  return res.json(await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }));
});

adminRouter.get("/transactions", async (_req, res) => {
  return res.json(await prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 200 }));
});

adminRouter.post("/payments/:id/retry", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment?.stripeInvoiceId) return res.status(400).json({ error: "no_stripe_invoice" });
  if (!stripe) return res.status(501).json({ error: "stripe_not_configured" });
  await stripe.invoices.pay(payment.stripeInvoiceId);
  await logAuditEvent({
    action: "admin.payment_retry_triggered",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "payment",
    targetId: payment.id,
    metadata: { stripeInvoiceId: payment.stripeInvoiceId },
    ...auditCtx,
  });
  return res.json({ ok: true });
});

adminRouter.get("/email-settings", async (_req, res) => {
  return res.json(await getAdminEmailSettingsPayload());
});

adminRouter.put("/email-settings", validate(emailSettingsPutSchema), async (req, res) => {
  const { provider, fromEmail, fromName, settings, secrets } = req.validatedBody;
  try {
    await saveAdminEmailSettings({
      provider,
      fromEmail,
      fromName: fromName ?? "",
      settings: settings ?? {},
      secrets: secrets ?? {},
    });
  } catch (e) {
    if (String(e?.message).includes("email_secrets_key_missing")) {
      return res.status(400).json({
        error: "secrets_key_required",
        message: "Set EMAIL_SECRETS_KEY on the API server (16+ characters) before saving email credentials.",
      });
    }
    throw e;
  }
  return res.json(await getAdminEmailSettingsPayload());
});

adminRouter.delete("/email-settings", async (_req, res) => {
  await prisma.emailSettings.deleteMany({ where: { id: "default" } });
  const payload = await getAdminEmailSettingsPayload();
  return res.json({ ok: true, ...payload });
});

adminRouter.post("/email-settings/test", validate(emailTestSchema), async (req, res) => {
  const to = req.validatedBody.to ?? req.auth.email;
  await sendTransactionalEmail({
    to,
    subject: "Sitropix portal — email test",
    html: "<p>This is a test message from the admin email settings screen.</p>",
    template: "admin_email_test",
    idempotencyKey: `admin_email_test_${req.auth.userId}_${Date.now()}`,
  });
  return res.json({ ok: true, to });
});

adminRouter.get("/feature-flags", async (_req, res) => {
  return res.json(await listFeatureFlagsForAdmin());
});

adminRouter.patch("/feature-flags/:key", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const { key } = req.params;
  const enabled = req.body?.enabled;
  if (typeof enabled !== "boolean") return res.status(400).json({ error: "invalid_body" });
  await ensureFeatureFlagDefaults();
  try {
    const updated = await prisma.featureFlag.update({
      where: { key },
      data: { enabled },
    });
    await logAuditEvent({
      action: "admin.feature_flag_updated",
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      targetType: "feature_flag",
      targetId: key,
      metadata: { enabled: updated.enabled },
      ...auditCtx,
    });
    return res.json(updated);
  } catch {
    return res.status(404).json({ error: "unknown_flag_key" });
  }
});

adminRouter.post("/plans/:planId/feature-overrides", async (req, res) => {
  const { planId } = req.params;
  const { key, enabled } = req.body ?? {};
  if (!key || typeof enabled !== "boolean") return res.status(400).json({ error: "invalid_body" });
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return res.status(404).json({ error: "plan_not_found" });
  const row = await prisma.planFeatureOverride.upsert({
    where: { planId_key: { planId, key } },
    create: { planId, key, enabled },
    update: { enabled },
  });
  return res.json(row);
});

adminRouter.delete("/plans/:planId/feature-overrides/:key", async (req, res) => {
  await prisma.planFeatureOverride.deleteMany({
    where: { planId: req.params.planId, key: req.params.key },
  });
  return res.json({ ok: true });
});

adminRouter.get("/users", async (_req, res) => {
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
      subscriptions: {
        take: 1,
        orderBy: { updatedAt: "desc" },
        select: { id: true, status: true, planId: true, plan: { select: { name: true, code: true } } },
      },
    },
  });
  return res.json(rows);
});

adminRouter.get("/audit-logs", async (req, res) => {
  const action = String(req.query.action ?? "").trim();
  const targetType = String(req.query.targetType ?? "").trim();
  const actorUserId = String(req.query.actorUserId ?? "").trim();
  const startAtRaw = String(req.query.startAt ?? "").trim();
  const endAtRaw = String(req.query.endAt ?? "").trim();
  const pageRaw = Number(req.query.page ?? 1);
  const limitRaw = Number(req.query.limit ?? 100);
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.trunc(pageRaw)) : 1;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.trunc(limitRaw))) : 100;
  const skip = (page - 1) * limit;

  const where = {};
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (actorUserId) where.actorUserId = actorUserId;
  if (startAtRaw || endAtRaw) {
    where.createdAt = {};
    if (startAtRaw) where.createdAt.gte = new Date(startAtRaw);
    if (endAtRaw) where.createdAt.lte = new Date(endAtRaw);
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return res.json({
    rows,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

adminRouter.get("/audit-logs/summary", async (_req, res) => {
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [last24hTotal, last7dTotal, failedLogins24h, adminMutations24h] = await Promise.all([
    prisma.auditLog.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.auditLog.count({ where: { action: "auth.login_failed", createdAt: { gte: dayAgo } } }),
    prisma.auditLog.count({ where: { action: { startsWith: "admin." }, createdAt: { gte: dayAgo } } }),
  ]);

  return res.json({
    last24hTotal,
    last7dTotal,
    failedLogins24h,
    adminMutations24h,
  });
});

adminRouter.get("/audit-logs/export.csv", async (req, res) => {
  const action = String(req.query.action ?? "").trim();
  const targetType = String(req.query.targetType ?? "").trim();
  const actorUserId = String(req.query.actorUserId ?? "").trim();
  const startAtRaw = String(req.query.startAt ?? "").trim();
  const endAtRaw = String(req.query.endAt ?? "").trim();
  const where = {};
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (actorUserId) where.actorUserId = actorUserId;
  if (startAtRaw || endAtRaw) {
    where.createdAt = {};
    if (startAtRaw) where.createdAt.gte = new Date(startAtRaw);
    if (endAtRaw) where.createdAt.lte = new Date(endAtRaw);
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const escapeCsv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = [
    "createdAt",
    "action",
    "actorUserId",
    "actorRole",
    "targetType",
    "targetId",
    "ipAddress",
    "requestId",
    "metadata",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.createdAt.toISOString(),
        r.action,
        r.actorUserId ?? "",
        r.actorRole ?? "",
        r.targetType ?? "",
        r.targetId ?? "",
        r.ipAddress ?? "",
        r.requestId ?? "",
        JSON.stringify(r.metadata ?? {}),
      ]
        .map(escapeCsv)
        .join(","),
    ),
  ];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="audit_logs.csv"');
  return res.send(lines.join("\n"));
});

adminRouter.post("/users/:userId/password-reset", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user) return res.status(404).json({ error: "user_not_found" });
  const resetToken = randomToken(24);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: sha256(resetToken),
      passwordResetExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 2),
    },
  });
  await sendTransactionalEmail({
    to: user.email,
    template: "password_reset",
    idempotencyKey: `admin_pwd_reset_${user.id}_${Date.now()}`,
    subject: "Password reset",
    html: `<p>Hi ${user.name},</p><p>An administrator requested a password reset for your account.</p><p><a href="${env.appUrl}/reset-password?token=${resetToken}">Set new password</a> (link expires in 2 hours).</p>`,
  });
  await logAuditEvent({
    action: "admin.password_reset_requested_for_user",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "user",
    targetId: user.id,
    metadata: { email: user.email },
    ...auditCtx,
  });
  return res.json({ ok: true });
});

adminRouter.get("/analytics", async (_req, res) => {
  const subs = await prisma.subscription.findMany({
    where: { status: { in: ["active", "trialing"] } },
    include: { plan: true },
  });
  let mrrCents = 0;
  for (const s of subs) {
    if (s.billingCycle === "monthly") mrrCents += s.plan.priceMonthlyCents;
    else mrrCents += Math.round(s.plan.priceYearlyCents / 12);
  }
  const succeeded = await prisma.payment.aggregate({
    where: { status: "succeeded" },
    _sum: { amountCents: true },
  });
  const activeSubscriptions = await prisma.subscription.count({ where: { status: { in: ["active", "trialing"] } } });
  const total = await prisma.subscription.count();
  const canceled = await prisma.subscription.count({ where: { status: "canceled" } });
  const failedPayments = await prisma.payment.count({ where: { status: "failed" } });
  return res.json({
    mrrCents,
    totalRevenueCents: succeeded._sum.amountCents ?? 0,
    activeSubscriptions,
    churnRate: total ? Number(((canceled / total) * 100).toFixed(2)) : 0,
    failedPayments,
  });
});

export { router as subscriptionRouter, adminRouter };
