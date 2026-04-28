import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { prisma } from "../db/client.mjs";
import { env } from "../config/env.mjs";
import { FEATURE_EXPERIMENT_PRICING_LAYOUT, PRICING_LAYOUT_VARIANTS } from "../constants/experimentKeys.mjs";
import { requireAuth, requireModuleAccess, requireRole } from "../middleware/auth.mjs";
import { validate } from "../middleware/validate.mjs";
import {
  adminFeatureFlagPatchSchema,
  adminUserModuleAccessPutSchema,
  adminUserRolePatchSchema,
  adminUserSetPasswordSchema,
  adminSubscriptionPatchSchema,
  billingPortalSchema,
  bootstrapSubscriptionSchema,
  changePlanSchema,
  checkoutSessionSchema,
  couponSchema,
  emptyObjectSchema,
  funnelEventSchema,
  paymentMethodSchema,
  planPatchSchema,
  planSchema,
} from "../schemas/billingSchemas.mjs";
import { createInviteSchema } from "../schemas/inviteSchemas.mjs";
import { emailSettingsPutSchema, emailTestSchema } from "../schemas/emailSettingsSchemas.mjs";
import { systemConfigPutSchema } from "../schemas/systemConfigSchemas.mjs";
import { getAdminEmailSettingsPayload, saveAdminEmailSettings } from "../services/emailSettingsStore.mjs";
import { getSystemConfigPayload, saveSystemConfig } from "../services/systemConfigStore.mjs";
import { sendTransactionalEmail } from "../services/emailService.mjs";
import { assertStripeConfigured, stripe } from "../services/stripeService.mjs";
import { buildProrationBreakdown, planPriceForCycle } from "../services/billingProration.mjs";
import {
  syncPaidInvoicesFromStripe,
  syncSubscriptionFromStripeForUserId,
} from "../services/stripeSubscriptionSync.mjs";
import { logAuditEvent, requestAuditContext } from "../services/auditLogService.mjs";
import {
  ensureFeatureFlagDefaults,
  listFeatureFlagsForAdmin,
  resolveSubscriptionFeatureControls,
  resolveSubscriptionPricingLayout,
} from "../services/featureFlagService.mjs";
import { randomToken, sha256 } from "../utils/crypto.mjs";
import { log } from "../observability/logger.mjs";
import { metricsBilling } from "../observability/metrics.mjs";

const router = express.Router();
router.use(requireAuth);

const funnelEventLimiter = rateLimit({
  windowMs: 60_000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.auth?.userId) return `u:${req.auth.userId}`;
    const raw = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    return `ip:${ipKeyGenerator(raw)}`;
  },
});

/** Conversion funnel (authenticated) — used for pricing/checkout instrumentation. */
router.post("/funnel", funnelEventLimiter, validate(funnelEventSchema), async (req, res) => {
  const { name, properties } = req.validatedBody;
  await prisma.funnelEvent.create({
    data: {
      userId: req.auth.userId,
      name,
      props: properties ?? {},
    },
  });
  if (String(process.env.FUNNEL_LOG_STDOUT).trim() === "1" || env.nodeEnv !== "production") {
    log.info("funnel.event", {
      name,
      userId: req.auth.userId,
      props: properties ?? {},
    });
  }
  return res.json({ ok: true });
});

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

function isAllowedRedirect(urlLike) {
  try {
    const parsed = new URL(urlLike);
    const origin = `${parsed.protocol}//${parsed.host}`.toLowerCase();
    return env.allowedRedirectOrigins.includes(origin);
  } catch {
    return false;
  }
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
    log.warn("portal.stripe_payment_methods_failed", { error: e?.message });
    return [];
  }
}

router.get("/portal", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  const [plans, initialSubscription, initialPayments] = await Promise.all([
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

  let subscription = initialSubscription;
  let payments = initialPayments;

  async function reloadPayments() {
    payments = await prisma.payment.findMany({
      where: { userId: req.auth.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  if (payments.length === 0 && subscription?.stripeSubscriptionId) {
    try {
      await syncPaidInvoicesFromStripe(
        req.auth.userId,
        subscription.id,
        subscription.stripeSubscriptionId,
        user?.stripeCustomerId ?? subscription?.stripeCustomerId ?? null,
      );
      await reloadPayments();
    } catch (e) {
      log.warn("portal.invoice_backfill_failed", { userId: req.auth.userId, error: e?.message });
    }
  }

  if (
    payments.length === 0 &&
    subscription &&
    subscription.status !== "canceled" &&
    !subscription.stripeSubscriptionId
  ) {
    try {
      const out = await syncSubscriptionFromStripeForUserId(req.auth.userId);
      if (out?.ok) {
        subscription = await prisma.subscription.findUnique({
          where: { userId: req.auth.userId },
          include: { plan: true },
        });
        await reloadPayments();
      }
    } catch (e) {
      log.warn("portal.subscription_stripe_sync_failed", { userId: req.auth.userId, error: e?.message });
    }
  }

  const customerId = user?.stripeCustomerId ?? subscription?.stripeCustomerId ?? null;
  const [paymentMethods] = await Promise.all([
    stripeCardPaymentMethodsForCustomer(customerId, req.auth.userId),
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

  const [featureControls, experiments] = await Promise.all([
    resolveSubscriptionFeatureControls(portalSubscription?.planId ?? null),
    resolveSubscriptionPricingLayout(),
  ]);

  return res.json({
    user: {
      id: req.auth.userId,
      email: req.auth.email,
      name: user?.name ?? req.auth.name,
      role: req.auth.role,
      phoneNumber: user?.phoneNumber ?? null,
    },
    plans: plans.map(mapPlan),
    subscription: portalSubscription,
    featureControls,
    experiments,
    invoices: (payments ?? []).map((i) => ({
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

router.post("/bootstrap", validate(bootstrapSubscriptionSchema), async (req, res) => {
  if (process.env.ALLOW_DEV_TRIAL !== "true") {
    return res.status(400).json({ error: "use_stripe_checkout", message: "Complete subscription via Stripe Checkout." });
  }
  const { planId, billingCycle = "monthly" } = req.validatedBody;
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

router.post("/change-plan", validate(changePlanSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const { planId, billingCycle } = req.validatedBody;
  const sub = await prisma.subscription.findUnique({
    where: { userId: req.auth.userId },
    include: { plan: true },
  });
  const nextPlan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!sub || !nextPlan) return res.status(404).json({ error: "subscription_or_plan_not_found" });

  const cycle = billingCycle ?? sub.billingCycle;
  const currentCost = planPriceForCycle(sub.plan, cycle);
  const nextCost = planPriceForCycle(nextPlan, cycle);
  const isDowngrade = nextCost < currentCost;
  const fc = await resolveSubscriptionFeatureControls(sub.planId);
  const proration = buildProrationBreakdown({
    currentPlan: sub.plan,
    nextPlan,
    cycle,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
  });
  if (isDowngrade && !fc.selfDowngrade) {
    return res.status(400).json({
      error: "downgrade_requires_period_end",
      message: "Downgrades are only available at the end of the current billing period.",
      currentPeriodEnd: sub.currentPeriodEnd,
      proration,
    });
  }

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
    metadata: {
      previousPlanId: sub.planId,
      nextPlanId: nextPlan.id,
      billingCycle: cycle,
      chargeNowCents: proration.chargeNowCents,
      unusedCreditCents: proration.unusedCreditCents,
    },
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

  metricsBilling.changePlan();
  return res.json({ subscription: updated, proration });
});

router.post("/cancel", validate(emptyObjectSchema), async (req, res) => {
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

router.post("/pause", validate(emptyObjectSchema), async (req, res) => {
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

router.post("/resume", validate(emptyObjectSchema), async (req, res) => {
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

router.post("/checkout-session", validate(checkoutSessionSchema), async (req, res) => {
  assertStripeConfigured();
  const { planId, billingCycle = "monthly", successUrl: successUrlOverride, cancelUrl: cancelUrlOverride } = req.validatedBody;
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return res.status(404).json({ error: "plan_not_found" });
  const stripePriceId = billingCycle === "yearly" ? plan.stripePriceYearlyId : plan.stripePriceMonthlyId;
  if (!stripePriceId) return res.status(400).json({ error: "missing_stripe_price_mapping" });
  const successUrl = successUrlOverride ?? env.stripeSuccessUrl;
  const cancelUrl = cancelUrlOverride ?? env.stripeCancelUrl;
  if (!isAllowedRedirect(successUrl) || !isAllowedRedirect(cancelUrl)) {
    return res.status(400).json({
      error: "invalid_redirect_url",
      message: "Redirect URL is not in the allowed origin list.",
    });
  }
  let checkoutSuccessUrl = successUrl;
  try {
    const u = new URL(successUrl);
    u.searchParams.set("subscriptionFunnel", "checkout_return");
    checkoutSuccessUrl = u.toString();
  } catch {
    checkoutSuccessUrl = successUrl;
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: req.auth.userId,
    customer_email: req.auth.email,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: checkoutSuccessUrl,
    cancel_url: cancelUrl,
    metadata: { userId: req.auth.userId, planId: plan.id, billingCycle },
    subscription_data: {
      metadata: { userId: req.auth.userId, planId: plan.id, billingCycle },
    },
  });
  metricsBilling.checkoutSessionCreated();
  return res.json({ url: session.url });
});

router.post("/billing-portal", validate(billingPortalSchema), async (req, res) => {
  assertStripeConfigured();
  const sub = await prisma.subscription.findUnique({ where: { userId: req.auth.userId } });
  if (!sub?.stripeCustomerId) return res.status(400).json({ error: "missing_stripe_customer" });
  const returnUrl = req.validatedBody.returnUrl ?? `${env.appUrl}/billing`;
  if (!isAllowedRedirect(returnUrl)) {
    return res.status(400).json({
      error: "invalid_redirect_url",
      message: "Redirect URL is not in the allowed origin list.",
    });
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: returnUrl,
  });
  return res.json({ url: session.url });
});

/* ------------- Admin ------------- */
const adminRouter = express.Router();
adminRouter.use(requireAuth, requireRole("admin", "master_admin"));
adminRouter.use("/plans", requireModuleAccess("plans"));
adminRouter.use("/invites", requireModuleAccess("invites"));
adminRouter.use("/customers", requireModuleAccess("customers"));
adminRouter.use("/audit-logs", requireModuleAccess("audit_logs"));
adminRouter.use("/email-settings", requireModuleAccess("email"));
adminRouter.use("/system-config", requireModuleAccess("environment"));
adminRouter.use("/users", requireModuleAccess("users"));
adminRouter.use("/user-management", requireModuleAccess("users"));
adminRouter.use("/feature-flags", requireModuleAccess("features"));
adminRouter.use("/subscriptions", requireModuleAccess("customers"));
adminRouter.use("/coupons", requireModuleAccess("plans"));
adminRouter.use("/transactions", requireModuleAccess("dashboard"));
adminRouter.use("/payments", requireModuleAccess("dashboard"));
adminRouter.use("/analytics", requireModuleAccess("dashboard"));

adminRouter.get("/plans", async (_req, res) => {
  const plans = await prisma.plan.findMany({ orderBy: { createdAt: "desc" } });
  return res.json(plans);
});

adminRouter.post("/plans", validate(planSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const p = req.validatedBody;
  let stripeProductId = null;
  let stripePriceMonthlyId = null;
  let stripePriceYearlyId = null;
  if (stripe) {
    try {
      const product = await stripe.products.create({
        name: p.name,
        description: p.description ?? "",
        metadata: { code: p.code, source: "admin_portal" },
      });
      stripeProductId = product.id;
      const [monthlyPrice, yearlyPrice] = await Promise.all([
        stripe.prices.create({
          product: product.id,
          unit_amount: p.priceMonthlyCents,
          currency: (p.currency ?? "USD").toLowerCase(),
          recurring: { interval: "month" },
          metadata: { code: p.code, billingCycle: "monthly" },
        }),
        stripe.prices.create({
          product: product.id,
          unit_amount: p.priceYearlyCents,
          currency: (p.currency ?? "USD").toLowerCase(),
          recurring: { interval: "year" },
          metadata: { code: p.code, billingCycle: "yearly" },
        }),
      ]);
      stripePriceMonthlyId = monthlyPrice.id;
      stripePriceYearlyId = yearlyPrice.id;
    } catch (e) {
      return res.status(502).json({
        error: "stripe_plan_create_failed",
        message: e?.message ?? "Could not create Stripe product and prices.",
      });
    }
  }
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
      stripeProductId,
      stripePriceMonthlyId,
      stripePriceYearlyId,
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
  const row = await prisma.plan.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "plan_not_found" });
  const attachedSubscriptions = await prisma.subscription.count({
    where: { planId: row.id, status: { not: "canceled" } },
  });
  if (attachedSubscriptions > 0) {
    return res.status(400).json({
      error: "plan_in_use",
      message: "Cannot delete a plan that still has active or trialing subscriptions.",
      activeSubscriptions: attachedSubscriptions,
    });
  }
  await prisma.plan.delete({ where: { id: row.id } });
  await logAuditEvent({
    action: "admin.plan_deleted",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "plan",
    targetId: row.id,
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
      resendCount: 0,
      lastSentAt: new Date(),
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
      resendCount: r.resendCount,
      lastSentAt: r.lastSentAt,
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

adminRouter.post("/invites/:id/resend", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const row = await prisma.invite.findUnique({
    where: { id: req.params.id },
    include: { plan: { select: { name: true } } },
  });
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.acceptedAt) return res.status(400).json({ error: "already_accepted" });
  if (row.revokedAt) return res.status(400).json({ error: "invite_revoked" });
  if (row.expiresAt.getTime() < Date.now()) return res.status(400).json({ error: "invite_expired" });

  const plainToken = randomToken(32);
  const updated = await prisma.invite.update({
    where: { id: row.id },
    data: { tokenHash: sha256(plainToken), resendCount: { increment: 1 }, lastSentAt: new Date() },
  });
  const signupUrl = `${env.appUrl}/signup?invite=${encodeURIComponent(plainToken)}`;
  const planLine = row.plan ? `<p>Your workspace includes the <strong>${row.plan.name}</strong> plan.</p>` : "";
  await sendTransactionalEmail({
    to: row.email,
    template: "invite",
    idempotencyKey: `invite_resend_${row.id}_${Date.now()}`,
    subject: "Your Sitropix invite link",
    html: `<p>Your invitation link has been re-sent.</p>${planLine}<p><a href="${signupUrl}">Accept invitation</a></p>`,
  });
  await logAuditEvent({
    action: "admin.invite_resent",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "invite",
    targetId: row.id,
    metadata: { email: row.email, resendCount: updated.resendCount },
    ...auditCtx,
  });
  return res.json({ ok: true, id: updated.id, email: updated.email });
});

adminRouter.get("/customers", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { subscriptions: { include: { plan: true } } },
    take: 200,
  });
  return res.json(users);
});

adminRouter.get("/customers/:id/profile", async (req, res) => {
  const userId = String(req.params.id);
  const [user, subscription, tickets, documents, transactions, revenue] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phoneNumber: true,
        isEmailVerified: true,
        isActive: true,
        deactivatedAt: true,
        createdAt: true,
      },
    }),
    prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    }),
    prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { _count: { select: { messages: true } } },
    }),
    prisma.clientDocument.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { subscription: { include: { plan: true } } },
    }),
    prisma.payment.aggregate({
      where: { userId, status: "succeeded" },
      _sum: { amountCents: true },
    }),
  ]);
  if (!user) return res.status(404).json({ error: "user_not_found" });

  const nextBillingAmountCents =
    subscription?.plan == null
      ? null
      : subscription.billingCycle === "yearly"
        ? subscription.plan.priceYearlyCents
        : subscription.plan.priceMonthlyCents;

  return res.json({
    overview: {
      user,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            nextBillingDate: subscription.currentPeriodEnd,
            nextBillingAmountCents,
            plan: subscription.plan
              ? { id: subscription.plan.id, code: subscription.plan.code, name: subscription.plan.name }
              : null,
          }
        : null,
      totalGeneratedRevenueCents: revenue._sum.amountCents ?? 0,
    },
    tickets: tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      department: t.department,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      threadCount: t._count.messages,
    })),
    documents,
    transactions: transactions.map((p) => ({
      id: p.id,
      invoiceNumber: p.invoiceNumber,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      paidAt: p.paidAt,
      paymentMode: p.stripeInvoiceId ? "Stripe" : "Manual",
      nextBillingAmountCents:
        p.subscription?.plan == null
          ? null
          : p.subscription.billingCycle === "yearly"
            ? p.subscription.plan.priceYearlyCents
            : p.subscription.plan.priceMonthlyCents,
    })),
  });
});

adminRouter.get("/customers/:id/delete-preview", async (req, res) => {
  const userId = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) return res.status(404).json({ error: "user_not_found" });
  const [subscriptions, payments, tickets, ticketMessages, documents, refreshTokens] = await Promise.all([
    prisma.subscription.count({ where: { userId } }),
    prisma.payment.count({ where: { userId } }),
    prisma.supportTicket.count({ where: { userId } }),
    prisma.ticketMessage.count({ where: { userId } }),
    prisma.clientDocument.count({ where: { userId } }),
    prisma.refreshToken.count({ where: { userId } }),
  ]);
  return res.json({
    userId,
    email: user.email,
    counts: { subscriptions, payments, tickets, ticketMessages, documents, refreshTokens },
  });
});

adminRouter.post("/customers/:id/deactivate", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const userId = String(req.params.id);
  if (userId === req.auth.userId) return res.status(400).json({ error: "cannot_deactivate_self" });
  const reason = String(req.body?.reason ?? "").trim().slice(0, 240) || null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "user_not_found" });
  if (user.role === "master_admin" && req.auth.role !== "master_admin") {
    return res.status(403).json({ error: "forbidden_role_target" });
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { isActive: false, deactivatedAt: new Date(), deactivationReason: reason },
    }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await logAuditEvent({
    action: "admin.customer_deactivated",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "user",
    targetId: userId,
    metadata: { reason },
    ...auditCtx,
  });
  return res.json({ ok: true });
});

adminRouter.post("/customers/:id/reactivate", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const userId = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "user_not_found" });
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: true, deactivatedAt: null, deactivationReason: null },
  });
  await logAuditEvent({
    action: "admin.customer_reactivated",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "user",
    targetId: userId,
    ...auditCtx,
  });
  return res.json({ ok: true });
});

adminRouter.delete("/customers/:id", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const userId = String(req.params.id);
  const confirm = String(req.body?.confirm ?? "");
  if (userId === req.auth.userId) return res.status(400).json({ error: "cannot_delete_self" });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) return res.status(404).json({ error: "user_not_found" });
  const full = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (full?.role === "master_admin" && req.auth.role !== "master_admin") {
    return res.status(403).json({ error: "forbidden_role_target" });
  }
  if (confirm !== user.email) {
    return res.status(400).json({ error: "confirmation_mismatch", message: "Confirmation must match user email." });
  }
  await prisma.user.delete({ where: { id: userId } });
  await logAuditEvent({
    action: "admin.customer_deleted",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "user",
    targetId: userId,
    metadata: { email: user.email },
    ...auditCtx,
  });
  return res.json({ ok: true });
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

adminRouter.patch("/subscriptions/:id", validate(adminSubscriptionPatchSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const body = req.validatedBody ?? {};
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

adminRouter.post("/customers/:id/sync-stripe", async (req, res) => {
  const userId = String(req.params.id);
  try {
    const out = await syncSubscriptionFromStripeForUserId(userId);
    return res.json(out);
  } catch (e) {
    const msg = e?.message ?? String(e);
    if (msg.includes("stripe_not_configured")) {
      return res.json({ ok: false, reason: "stripe_not_configured" });
    }
    return res.json({ ok: false, reason: "sync_failed", error: msg });
  }
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
  const out = await sendTransactionalEmail({
    to,
    subject: "Sitropix portal — email test",
    html: "<p>This is a test message from the admin email settings screen.</p>",
    template: "admin_email_test",
    idempotencyKey: `admin_email_test_${req.auth.userId}_${Date.now()}`,
  });
  if (!out?.sent) {
    return res.status(502).json({
      error: "email_delivery_failed",
      message: "Test email could not be delivered. Check provider credentials, sender verification, and server logs.",
      to,
      used: out?.used ?? "unknown",
    });
  }
  return res.json({ ok: true, to, used: out.used });
});

adminRouter.get("/system-config", async (req, res) => {
  if (req.auth.role !== "master_admin") return res.status(403).json({ error: "forbidden" });
  return res.json(await getSystemConfigPayload());
});

adminRouter.put("/system-config", validate(systemConfigPutSchema), async (req, res) => {
  if (req.auth.role !== "master_admin") return res.status(403).json({ error: "forbidden" });
  try {
    await saveSystemConfig(req.validatedBody.items ?? []);
  } catch (e) {
    if (String(e?.message).includes("email_secrets_key_missing")) {
      return res.status(400).json({
        error: "secrets_key_required",
        message: "Set EMAIL_SECRETS_KEY on the API server (16+ characters) before saving secret values.",
      });
    }
    throw e;
  }
  return res.json(await getSystemConfigPayload());
});

adminRouter.post("/system-config/test/db", async (req, res) => {
  if (req.auth.role !== "master_admin") return res.status(403).json({ error: "forbidden" });
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "db_test_failed", message: e?.message ?? "Database ping failed." });
  }
});

adminRouter.post("/system-config/test/stripe", async (req, res) => {
  if (req.auth.role !== "master_admin") return res.status(403).json({ error: "forbidden" });
  if (!stripe) return res.status(400).json({ error: "stripe_not_configured" });
  try {
    await stripe.accounts.retrieve();
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "stripe_test_failed", message: e?.message ?? "Stripe key test failed." });
  }
});

adminRouter.get("/feature-flags", async (_req, res) => {
  return res.json(await listFeatureFlagsForAdmin());
});

adminRouter.patch("/feature-flags/:key", validate(adminFeatureFlagPatchSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const { key } = req.params;
  const { enabled, stringValue } = req.validatedBody;
  if (stringValue !== undefined && key !== FEATURE_EXPERIMENT_PRICING_LAYOUT) {
    return res.status(400).json({
      error: "string_value_not_applicable",
      message: "stringValue is only used for the pricing layout experiment flag.",
    });
  }
  if (key === FEATURE_EXPERIMENT_PRICING_LAYOUT && stringValue != null) {
    if (!PRICING_LAYOUT_VARIANTS.includes(stringValue)) {
      return res.status(400).json({
        error: "invalid_experiment_variant",
        message: "Unknown pricing layout variant.",
      });
    }
  }
  await ensureFeatureFlagDefaults();
  const data = {};
  if (typeof enabled === "boolean") data.enabled = enabled;
  if (stringValue !== undefined) data.stringValue = stringValue;
  try {
    const updated = await prisma.featureFlag.update({
      where: { key },
      data,
    });
    await logAuditEvent({
      action: "admin.feature_flag_updated",
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      targetType: "feature_flag",
      targetId: key,
      metadata: { enabled: updated.enabled, stringValue: updated.stringValue },
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
      isActive: true,
      deactivatedAt: true,
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

adminRouter.get("/user-management/users", async (_req, res) => {
  const [users, invites] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 400,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isEmailVerified: true,
        isActive: true,
        deactivatedAt: true,
        createdAt: true,
        moduleAccess: {
          select: { moduleKey: true, enabled: true },
        },
      },
    }),
    prisma.invite.findMany({
      where: { acceptedAt: null, revokedAt: null, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, email: true, planId: true, createdAt: true, expiresAt: true },
    }),
  ]);
  return res.json({
    users: users.map((u) => ({
      ...u,
      status: u.isActive ? "active" : "deactivated",
      moduleAccess: u.moduleAccess,
    })),
    invites: invites.map((i) => ({ ...i, status: "invite_pending" })),
  });
});

adminRouter.post("/user-management/invite", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const role = String(req.body?.role ?? "support");
  if (!name || !email.includes("@")) return res.status(400).json({ error: "invalid_input" });
  if (!["manager", "admin", "master_admin", "support", "user"].includes(role)) {
    return res.status(400).json({ error: "invalid_role" });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "email_taken" });
  const plainToken = randomToken(32);
  const invite = await prisma.invite.create({
    data: {
      email,
      tokenHash: sha256(plainToken),
      planId: null,
      message: `Hi ${name}, your account role will be ${role}.`,
      expiresAt: new Date(Date.now() + 14 * 864e5),
      createdByUserId: req.auth.userId,
    },
  });
  const signupUrl = `${env.appUrl}/signup?invite=${encodeURIComponent(plainToken)}`;
  await sendTransactionalEmail({
    to: email,
    template: "invite",
    idempotencyKey: `user_mgmt_invite_${invite.id}`,
    subject: "Your account invitation",
    html: `<p>Hi ${name},</p><p>You have been invited to join Sitropix.</p><p><a href="${signupUrl}">Set password and activate your account</a></p>`,
  });
  await logAuditEvent({
    action: "admin.user_invite_sent",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "invite",
    targetId: invite.id,
    metadata: { email, role },
    ...auditCtx,
  });
  return res.status(201).json({ ok: true, id: invite.id, email });
});

adminRouter.post("/user-management/users/:id/deactivate", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const userId = String(req.params.id);
  if (userId === req.auth.userId) return res.status(400).json({ error: "cannot_deactivate_self" });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "user_not_found" });
  if (user.role === "master_admin" && req.auth.role !== "master_admin") {
    return res.status(403).json({ error: "forbidden_role_target" });
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { isActive: false, deactivatedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await logAuditEvent({
    action: "admin.user_deactivated",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "user",
    targetId: userId,
    ...auditCtx,
  });
  return res.json({ ok: true });
});

adminRouter.post("/user-management/users/:id/reactivate", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const userId = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "user_not_found" });
  if (user.role === "master_admin" && req.auth.role !== "master_admin") {
    return res.status(403).json({ error: "forbidden_role_target" });
  }
  await prisma.user.update({ where: { id: userId }, data: { isActive: true, deactivatedAt: null } });
  await logAuditEvent({
    action: "admin.user_reactivated",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "user",
    targetId: userId,
    ...auditCtx,
  });
  return res.json({ ok: true });
});

adminRouter.patch("/user-management/users/:id/role", validate(adminUserRolePatchSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const userId = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "user_not_found" });
  if (userId === req.auth.userId) return res.status(400).json({ error: "cannot_change_own_role" });
  if (user.role === "master_admin" && req.auth.role !== "master_admin") {
    return res.status(403).json({ error: "forbidden_role_target" });
  }
  if (req.validatedBody.role === "master_admin" && req.auth.role !== "master_admin") {
    return res.status(403).json({ error: "forbidden_role_assignment" });
  }
  const updated = await prisma.user.update({ where: { id: userId }, data: { role: req.validatedBody.role } });
  await logAuditEvent({
    action: "admin.user_role_changed",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "user",
    targetId: userId,
    metadata: { previousRole: user.role, nextRole: updated.role },
    ...auditCtx,
  });
  return res.json({ ok: true, id: updated.id, role: updated.role });
});

adminRouter.put("/user-management/users/:id/module-access", validate(adminUserModuleAccessPutSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const userId = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "user_not_found" });
  const modules = req.validatedBody.modules ?? [];
  await prisma.$transaction(async (tx) => {
    await tx.userModuleAccess.deleteMany({ where: { userId } });
    if (modules.length > 0) {
      await tx.userModuleAccess.createMany({
        data: modules.map((m) => ({ userId, moduleKey: m.moduleKey, enabled: m.enabled })),
      });
    }
  });
  await logAuditEvent({
    action: "admin.user_module_access_updated",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "user",
    targetId: userId,
    metadata: { moduleCount: modules.length },
    ...auditCtx,
  });
  return res.json({ ok: true });
});

adminRouter.post("/user-management/users/:id/password-reset-link", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const userId = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id: userId } });
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
    idempotencyKey: `user_mgmt_pwd_reset_${user.id}_${Date.now()}`,
    subject: "Password reset",
    html: `<p>Hi ${user.name},</p><p><a href="${env.appUrl}/reset-password?token=${resetToken}">Set new password</a></p>`,
  });
  await logAuditEvent({
    action: "admin.user_password_reset_link_sent",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "user",
    targetId: user.id,
    metadata: { email: user.email },
    ...auditCtx,
  });
  return res.json({ ok: true });
});

adminRouter.post("/user-management/users/:id/set-password", validate(adminUserSetPasswordSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const userId = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "user_not_found" });
  const passwordHash = await bcrypt.hash(req.validatedBody.newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordResetToken: null, passwordResetExpiresAt: null },
    }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await sendTransactionalEmail({
    to: user.email,
    template: "account_security",
    idempotencyKey: `user_mgmt_pwd_set_${user.id}_${Date.now()}`,
    subject: "Your login password was updated",
    html: `<p>Hi ${user.name},</p><p>An administrator updated your account password. Please sign in again.</p>`,
  });
  await logAuditEvent({
    action: "admin.user_password_set_directly",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "user",
    targetId: user.id,
    metadata: { email: user.email },
    ...auditCtx,
  });
  return res.json({ ok: true });
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
  const startAt = startAtRaw ? new Date(startAtRaw) : null;
  const endAt = endAtRaw ? new Date(endAtRaw) : null;
  if ((startAtRaw && Number.isNaN(startAt?.getTime())) || (endAtRaw && Number.isNaN(endAt?.getTime()))) {
    return res.status(400).json({ error: "invalid_date_filter", message: "startAt/endAt must be valid ISO datetime values." });
  }

  const where = {};
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (actorUserId) where.actorUserId = actorUserId;
  if (startAtRaw || endAtRaw) {
    where.createdAt = {};
    if (startAt) where.createdAt.gte = startAt;
    if (endAt) where.createdAt.lte = endAt;
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
  const startAt = startAtRaw ? new Date(startAtRaw) : null;
  const endAt = endAtRaw ? new Date(endAtRaw) : null;
  if ((startAtRaw && Number.isNaN(startAt?.getTime())) || (endAtRaw && Number.isNaN(endAt?.getTime()))) {
    return res.status(400).json({ error: "invalid_date_filter", message: "startAt/endAt must be valid ISO datetime values." });
  }
  const where = {};
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (actorUserId) where.actorUserId = actorUserId;
  if (startAtRaw || endAtRaw) {
    where.createdAt = {};
    if (startAt) where.createdAt.gte = startAt;
    if (endAt) where.createdAt.lte = endAt;
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
