import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { ZodError } from "zod";
import { prisma } from "../db/client.mjs";
import { env } from "../config/env.mjs";
import { FEATURE_EXPERIMENT_PRICING_LAYOUT, PRICING_LAYOUT_VARIANTS } from "../constants/experimentKeys.mjs";
import { requireAuth, requireModuleAccess, requireRole } from "../middleware/auth.mjs";
import { validate } from "../middleware/validate.mjs";
import {
  addonPatchSchema,
  addonSchema,
  adminFeatureFlagPatchSchema,
  adminUserModuleAccessPutSchema,
  adminUserRolePatchSchema,
  adminUserSetPasswordSchema,
  adminSubscriptionPatchSchema,
  billingPortalSchema,
  bootstrapSubscriptionSchema,
  changePlanSchema,
  checkoutSessionSchema,
  addonCheckoutSessionSchema,
  confirmAddonCheckoutSchema,
  couponSchema,
  funnelEventSchema,
  paymentMethodSchema,
  projectSubscriptionActionSchema,
  planCatalogSyncSchema,
  planPatchSchema,
  planSchema,
  editTypePatchSchema,
} from "../schemas/billingSchemas.mjs";
import { createInviteSchema } from "../schemas/inviteSchemas.mjs";
import { emailSettingsPutSchema, emailTestSchema } from "../schemas/emailSettingsSchemas.mjs";
import { systemConfigPutSchema } from "../schemas/systemConfigSchemas.mjs";
import { getAdminEmailSettingsPayload, saveAdminEmailSettings } from "../services/emailSettingsStore.mjs";
import { getSystemConfigPayload, saveSystemConfig } from "../services/systemConfigStore.mjs";
import { sendTransactionalEmail } from "../services/emailService.mjs";
import { deleteExpiredPendingInvites } from "../services/inviteCleanup.mjs";
import { ensureStaffModuleAccess } from "../services/staffModuleAccess.mjs";
import { assertStripeConfigured, reloadStripeFromSystemConfig, stripe } from "../services/stripeService.mjs";
import {
  planPatchTriggersCatalogSync,
  runPlanCatalogSync,
  schedulePlanCatalogSync,
} from "../services/stripePlanCatalogSync.mjs";
import {
  buildProrationBreakdown,
  isPlanOneTimeOnly,
  planAllowsBillingCycle,
  planPriceForCycle,
  resolveBillingCycleForPlan,
} from "../services/billingProration.mjs";
import {
  readAddonEffectKind,
  creditSnapshotFromPlan,
  totalCreditsAvailable,
} from "../services/subscriptionCredits.mjs";
import { mergePlanWebsiteCatalogJson } from "../services/planWebsiteCatalog.mjs";
import {
  EXTRA_EDIT_BUNDLE_CODE,
  EXTRA_EDIT_SINGLE_CODE,
  addonEligibleForPlan,
  isPlanPricedExtraEditAddonCode,
  isRepeatableExtraEditPurchase,
  resolveCreditPackGrantForAddon,
  validateExtraEditAddonAgainstPlan,
} from "../services/extraEditCredits.mjs";
import { resolveAddonPlanPriceCents } from "../services/addonPlanPricing.mjs";
import {
  buildSubscriptionCheckoutAddonLineItems,
  createSeparateRecurringAddonSubscription,
  createStripeRecurringPriceForAddon,
} from "../services/recurringAddonStripe.mjs";
import {
  buildRecurringAttachEntry,
  isRecurringAddonRow,
  prepaidPeriodTrialEndUnix,
  recurringAddonFirstCheckoutCents,
  resolveChosenAddonRecurringCycle,
  resolveRecurringAddonAttachStrategy,
  subscriptionBillingAnchorUnix,
} from "../services/recurringAddonCheckout.mjs";
import {
  attachFailureResponse,
  findRecurringAddonStripeRow,
  upsertRecurringAddonStripeRow,
} from "../services/recurringAddonStripeStore.mjs";
import {
  resolveStripeCustomerIdForSubscription,
  syncPaidInvoicesFromStripe,
  syncSubscriptionFromStripeForUserId,
} from "../services/stripeSubscriptionSync.mjs";
import { syncRecurringAddonInvoicesFromStripe } from "../services/recurringAddonInvoiceSync.mjs";
import { resolveOrCreateStripeCustomerId } from "../services/stripeCustomerResolve.mjs";
import {
  findPrimaryUserSubscription,
  findUserProjectSubscription,
} from "../services/subscriptionLookup.mjs";
import { logAuditEvent, requestAuditContext } from "../services/auditLogService.mjs";
import {
  ensureFeatureFlagDefaults,
  listFeatureFlagsForAdmin,
  resolveSubscriptionFeatureControls,
  resolveSubscriptionPricingLayout,
} from "../services/featureFlagService.mjs";
import {
  fetchAllSubscriptionAddons,
  fetchPortalAddonCatalog,
  fetchSubscriptionAddonCatalog,
} from "../services/addonCatalogStore.mjs";
import { randomToken, sha256 } from "../utils/crypto.mjs";
import { log } from "../observability/logger.mjs";
import { metricsBilling } from "../observability/metrics.mjs";

const router = express.Router();
router.use(requireAuth);

function subscriptionDebug(req, step, fields = {}) {
  log.infoReq(req, `subscription.${step}`, fields);
}

function parseAttachRecurringEntries(meta) {
  const attachRaw = meta.attachRecurringAddonJson ? String(meta.attachRecurringAddonJson) : "";
  if (!attachRaw) return [];
  try {
    const parsed = JSON.parse(attachRaw);
    if (Array.isArray(parsed)) return parsed.filter((e) => e && typeof e === "object");
    if (parsed && typeof parsed === "object" && parsed.code) return [parsed];
  } catch {
    return [];
  }
  return [];
}

async function attachRecurringEntryToPlanSubscription({
  subMs,
  localSub,
  stripeSub,
  entry,
  arow,
  currency,
}) {
  const attachCode = String(entry.code ?? "").trim();
  const existingItems = await stripe.subscriptionItems.list({ subscription: subMs, limit: 100 });
  if (existingItems.data?.some((si) => si?.metadata?.sitropixAddon === attachCode)) {
    return { ok: true };
  }

  const recur = Math.max(
    0,
    Number(entry.recurringAmountCents) ||
      resolveAddonPlanPriceCents(
        localSub.plan,
        arow,
        entry.chosenCycle === "yearly" ? "yearly" : "monthly",
      ) ||
      arow.priceCents ||
      0,
  );
  if (recur <= 0) {
    return { ok: false, message: "invalid_recurring_amount" };
  }
  const intv = entry.interval === "year" ? "year" : "month";
  const price = await createStripeRecurringPriceForAddon(stripe, {
    currency,
    unitAmountCents: recur,
    interval: intv,
    label: arow.label,
    addonCode: attachCode,
  });
  const anchorUnix = subscriptionBillingAnchorUnix(localSub, stripeSub);
  const createParams = {
    subscription: subMs,
    proration_behavior: "none",
    metadata: { sitropixAddon: attachCode },
    price: price.id,
  };
  try {
    await stripe.subscriptionItems.create({
      ...createParams,
      billing_cycle_anchor: anchorUnix,
    });
  } catch (anchorErr) {
    const msg = anchorErr?.message ?? "";
    if (msg.includes("billing_cycle_anchor") || anchorErr?.code === "parameter_unknown") {
      await stripe.subscriptionItems.create(createParams);
    } else {
      throw anchorErr;
    }
  }
  return { ok: true };
}

async function attachRecurringEntryAsSeparateSubscription({
  entry,
  arow,
  currency,
  projectId,
  userId,
  stripeCustomerId,
  plan,
}) {
  const attachCode = String(entry.code ?? "").trim();
  const chosenCycle = entry.chosenCycle === "yearly" ? "yearly" : "monthly";
  const lookup = await findRecurringAddonStripeRow(projectId, attachCode);
  if (!lookup.ready.ok) {
    return { ok: false, message: lookup.ready.message, userMessage: lookup.ready.userMessage };
  }
  if (lookup.row?.stripeSubscriptionId) {
    return { ok: true };
  }

  const recur = Math.max(
    0,
    Number(entry.recurringAmountCents) ||
      resolveAddonPlanPriceCents(plan, arow, chosenCycle) ||
      arow.priceCents ||
      0,
  );
  if (recur <= 0) {
    return { ok: false, message: "invalid_recurring_amount" };
  }
  const intv = entry.interval === "year" ? "year" : "month";
  const trialEndUnix =
    typeof entry.trialEndUnix === "number" && entry.trialEndUnix > 0
      ? entry.trialEndUnix
      : prepaidPeriodTrialEndUnix(chosenCycle);

  const addonSub = await createSeparateRecurringAddonSubscription(stripe, {
    customerId: stripeCustomerId,
    currency,
    unitAmountCents: recur,
    interval: intv,
    label: arow.label,
    addonCode: attachCode,
    projectId,
    userId,
    trialEndUnix,
  });

  const saved = await upsertRecurringAddonStripeRow({
    projectId,
    addonCode: attachCode,
    stripeSubscriptionId: addonSub.id,
    billingCycle: chosenCycle,
  });
  if (!saved.ok) {
    return { ok: false, message: saved.message, userMessage: saved.userMessage };
  }
  return { ok: true };
}

/**
 * After a paid add-on checkout, wire recurring billing in Stripe.
 * Same interval as the plan → subscription item on the plan sub; otherwise a dedicated add-on sub.
 * First period was collected in Checkout (`mode: payment`); renewals use Stripe subscriptions.
 */
async function attachRecurringAddonIfNeeded(meta, localSub, addonCatalogRows, session, context = {}) {
  const entries = parseAttachRecurringEntries(meta);
  if (entries.length === 0) return { ok: true };

  const projectId = context.projectId ?? meta.projectId ?? null;
  const userId = context.userId ?? meta.userId ?? null;
  const stripeCustomerId =
    context.stripeCustomerId ??
    (typeof session.customer === "string" ? session.customer : session.customer?.id) ??
    localSub?.stripeCustomerId ??
    null;

  try {
    const currency = String(session.currency ?? "usd").toLowerCase();

    for (const entry of entries) {
      const attachCode = String(entry.code ?? "").trim();
      const arow = addonCatalogRows.find((r) => r.code === attachCode);
      if (!arow || !isRecurringAddonRow(arow)) {
        return { ok: false, message: "invalid_recurring_attach" };
      }

      const chosenCycle = entry.chosenCycle === "yearly" ? "yearly" : "monthly";
      const strategy =
        entry.attachStrategy === "separate_subscription" ||
        entry.attachStrategy === "same_subscription"
          ? entry.attachStrategy
          : resolveRecurringAddonAttachStrategy(localSub?.billingCycle ?? "monthly", chosenCycle);

      if (strategy === "separate_subscription") {
        if (!projectId || !userId || !stripeCustomerId) {
          return { ok: false, message: "missing_addon_subscription_context" };
        }
        const sep = await attachRecurringEntryAsSeparateSubscription({
          entry,
          arow,
          currency,
          projectId: String(projectId),
          userId: String(userId),
          stripeCustomerId: String(stripeCustomerId),
          plan: localSub?.plan ?? null,
        });
        if (!sep.ok) return sep;
        continue;
      }

      if (!localSub?.stripeSubscriptionId) {
        return { ok: false, message: "missing_stripe_subscription" };
      }
      const subMs = String(localSub.stripeSubscriptionId).trim();
      const stripeSub = await stripe.subscriptions.retrieve(subMs);
      const same = await attachRecurringEntryToPlanSubscription({
        subMs,
        localSub,
        stripeSub,
        entry,
        arow,
        currency,
      });
      if (!same.ok) return same;
    }
  } catch (e) {
    return { ok: false, message: e?.message ?? "stripe_subscription_item_failed" };
  }
  return { ok: true };
}

const DEFAULT_EMAIL_TEMPLATES = [
  {
    id: "invite",
    name: "Invite",
    subject: "You are invited to Sitropix",
    html: "<p>Hello {{name}},</p><p>You have been invited to Sitropix.</p><p><a href='{{signupUrl}}'>Create account</a></p>",
  },
  {
    id: "password_reset",
    name: "Password Reset",
    subject: "Reset your password",
    html: "<p>Hello {{name}},</p><p><a href='{{resetUrl}}'>Reset password</a></p>",
  },
];

function requireMasterAdmin(req, res, next) {
  if (req.auth?.role !== "master_admin") {
    return res.status(403).json({ error: "forbidden" });
  }
  return next();
}

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
  const projectId = String(req.body?.projectId ?? req.query?.projectId ?? "").trim() || null;
  subscriptionDebug(req, "sync_stripe.start", { userId: req.auth.userId, projectId });
  try {
    const out = await syncSubscriptionFromStripeForUserId(req.auth.userId, { projectId });
    subscriptionDebug(req, "sync_stripe.result", { userId: req.auth.userId, projectId, ...out });
    return res.json(out);
  } catch (e) {
    const msg = e?.message ?? String(e);
    if (msg.includes("stripe_not_configured")) {
      return res.json({ ok: false, reason: "stripe_not_configured" });
    }
    subscriptionDebug(req, "sync_stripe.error", { userId: req.auth.userId, projectId, error: msg });
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
    billingMonthlyEnabled: p.billingMonthlyEnabled ?? true,
    billingYearlyEnabled: p.billingYearlyEnabled ?? true,
    includedEditCreditsPerPeriod: p.includedEditCreditsPerPeriod ?? 0,
    catalogJson: p.catalogJson && typeof p.catalogJson === "object" ? p.catalogJson : {},
  };
}

/** Add-on is sold as a flat / one-time style SKU (still billed on the subscription interval in Stripe when paired with a recurring plan). */
function isAddonOneTimeStyle(row) {
  return row.billingMonthlyEnabled === false && row.billingYearlyEnabled === false;
}

function addonAllowedOnSubscriptionCycle(row, billingCycle) {
  if (isAddonOneTimeStyle(row)) return true;
  if (billingCycle === "yearly") return row.billingYearlyEnabled !== false;
  return row.billingMonthlyEnabled !== false;
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
    const msg = String(e?.message ?? "");
    if (msg.includes("No such customer")) {
      // Customer id belongs to a different Stripe account or was deleted.
      // Clear stale pointers so portal calls stop retrying the invalid id.
      await Promise.allSettled([
        prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: null },
        }),
        prisma.subscription.updateMany({
          where: { userId, stripeCustomerId: customerId },
          data: { stripeCustomerId: null },
        }),
      ]);
      log.warn("portal.stripe_customer_stale_id_cleared", { userId, customerId });
      return [];
    }
    log.warn("portal.stripe_payment_methods_failed", { error: e?.message });
    return [];
  }
}

router.get("/portal", async (req, res) => {
  subscriptionDebug(req, "portal.fetch.start", { userId: req.auth.userId });
  const projectIdFilter = String(req.query.projectId ?? "").trim() || null;
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  const [plans, allSubscriptions, initialPayments, addons] = await Promise.all([
    prisma.plan.findMany({ where: { isActive: true, archivedAt: null }, orderBy: { priceMonthlyCents: "asc" } }),
    prisma.subscription.findMany({
      where: { userId: req.auth.userId },
      orderBy: { updatedAt: "desc" },
      include: { plan: true, project: { select: { id: true, name: true } } },
    }),
    prisma.payment.findMany({
      where: { userId: req.auth.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    fetchPortalAddonCatalog(),
  ]);

  // Pick "current" subscription for the response: project-scoped when projectId is provided,
  // otherwise the most-recent active/trialing row, falling back to the most-recent any.
  function pickInitialSubscription() {
    if (projectIdFilter) {
      return allSubscriptions.find((s) => s.projectId === projectIdFilter) ?? null;
    }
    const live = allSubscriptions.find((s) => ["active", "trialing", "past_due", "paused"].includes(s.status));
    return live ?? allSubscriptions[0] ?? null;
  }

  let subscription = pickInitialSubscription();
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
      subscriptionDebug(req, "portal.invoice_backfill.start", { userId: req.auth.userId, subId: subscription.id });
      await syncPaidInvoicesFromStripe(
        req.auth.userId,
        subscription.id,
        subscription.stripeSubscriptionId,
        user?.stripeCustomerId ?? subscription?.stripeCustomerId ?? null,
      );
      await reloadPayments();
      subscriptionDebug(req, "portal.invoice_backfill.success", { userId: req.auth.userId, invoiceCount: payments.length });
    } catch (e) {
      log.warn("portal.invoice_backfill_failed", { userId: req.auth.userId, error: e?.message });
    }
  }

  if (subscription?.projectId) {
    try {
      await syncRecurringAddonInvoicesFromStripe(req.auth.userId, subscription.projectId);
      await reloadPayments();
    } catch (e) {
      log.warn("portal.addon_invoice_backfill_failed", {
        userId: req.auth.userId,
        projectId: subscription.projectId,
        error: e?.message,
      });
    }
  }

  if (
    payments.length === 0 &&
    subscription &&
    subscription.status !== "canceled" &&
    !subscription.stripeSubscriptionId
  ) {
    const planForSub = subscription.plan;
    const isOneTimePlanRow =
      planForSub &&
      planForSub.billingMonthlyEnabled === false &&
      planForSub.billingYearlyEnabled === false;
    if (!isOneTimePlanRow) {
      try {
        subscriptionDebug(req, "portal.subscription_reconcile.start", { userId: req.auth.userId });
        const out = await syncSubscriptionFromStripeForUserId(req.auth.userId);
        if (out?.ok) {
          subscription = await findPrimaryUserSubscription(req.auth.userId, { include: { plan: true } });
          await reloadPayments();
          subscriptionDebug(req, "portal.subscription_reconcile.success", { userId: req.auth.userId, ...out });
        }
      } catch (e) {
        log.warn("portal.subscription_stripe_sync_failed", { userId: req.auth.userId, error: e?.message });
      }
    }
  }

  const customerId = user?.stripeCustomerId ?? subscription?.stripeCustomerId ?? null;
  const [paymentMethods] = await Promise.all([
    stripeCardPaymentMethodsForCustomer(customerId, req.auth.userId),
  ]);

  function mapSubscriptionRow(row) {
    if (!row) return null;
    const subLike = {
      includedCreditsPerPeriod: row.includedCreditsPerPeriod,
      includedCreditsUsedThisPeriod: row.includedCreditsUsedThisPeriod,
      purchasedCreditsBalance: row.purchasedCreditsBalance,
    };
    return {
      id: row.id,
      userId: row.userId,
      projectId: row.projectId ?? null,
      projectName: row.project?.name ?? null,
      planId: row.planId,
      status: row.status,
      billingCycle: row.billingCycle,
      currentPeriodStart: row.currentPeriodStart,
      currentPeriodEnd: row.currentPeriodEnd,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      pausedAt: row.pausedAt,
      canceledAt: row.canceledAt,
      nextBillingDate: row.currentPeriodEnd,
      includedCreditsPerPeriod: row.includedCreditsPerPeriod ?? 0,
      includedCreditsUsedThisPeriod: row.includedCreditsUsedThisPeriod ?? 0,
      purchasedCreditsBalance: row.purchasedCreditsBalance ?? 0,
      websiteEditCreditsAvailable: totalCreditsAvailable(subLike),
      supportPriorityBoostUntil: row.supportPriorityBoostUntil ?? null,
      plan: row.plan ? mapPlan(row.plan) : undefined,
    };
  }

  const portalSubscription =
    subscription && subscription.status !== "canceled" ? mapSubscriptionRow(subscription) : null;
  const portalSubscriptions = allSubscriptions
    .filter((s) => s.status !== "canceled")
    .map((s) => mapSubscriptionRow(s));

  const [featureControls, experiments] = await Promise.all([
    resolveSubscriptionFeatureControls(portalSubscription?.planId ?? null),
    resolveSubscriptionPricingLayout(),
  ]);
  subscriptionDebug(req, "portal.fetch.success", {
    userId: req.auth.userId,
    hasSubscription: Boolean(portalSubscription),
    planCount: plans.length,
    invoiceCount: payments.length,
    paymentMethodCount: paymentMethods.length,
  });

  return res.json({
    user: {
      id: req.auth.userId,
      email: req.auth.email,
      name: user?.name ?? req.auth.name,
      role: req.auth.role,
      phoneNumber: user?.phoneNumber ?? null,
    },
    plans: plans.map(mapPlan),
    addons,
    subscription: portalSubscription,
    subscriptions: portalSubscriptions,
    featureControls,
    experiments,
    invoices: (payments ?? []).map((i) => ({
      id: i.id,
      subscriptionId: i.subscriptionId,
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
  const { planId, billingCycle: billingCycleRaw = "monthly", projectId } = req.validatedBody;
  subscriptionDebug(req, "bootstrap.start", { userId: req.auth.userId, planId, billingCycle: billingCycleRaw, projectId });
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return res.status(404).json({ error: "plan_not_found" });
  if (isPlanOneTimeOnly(plan)) {
    return res.status(400).json({
      error: "plan_requires_stripe_checkout",
      message: "This plan is purchased via Stripe checkout only.",
    });
  }
  const preferred = billingCycleRaw === "yearly" ? "yearly" : "monthly";
  const billingCycle = resolveBillingCycleForPlan(plan, preferred);
  if (!planAllowsBillingCycle(plan, billingCycle)) {
    return res.status(400).json({ error: "billing_cycle_not_available_for_plan" });
  }
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerUserId: req.auth.userId } });
  if (!project) return res.status(404).json({ error: "project_not_found" });
  const existing = await findUserProjectSubscription(req.auth.userId, projectId);
  if (existing) return res.json(existing);
  const now = new Date();
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + (billingCycle === "yearly" ? 365 : 30));
  const sub = await prisma.subscription.create({
    data: {
      userId: req.auth.userId,
      projectId,
      planId: plan.id,
      status: "trialing",
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: end,
      ...creditSnapshotFromPlan(plan),
    },
  });
  subscriptionDebug(req, "bootstrap.success", { userId: req.auth.userId, subscriptionId: sub.id, planId, billingCycle });
  return res.status(201).json(sub);
});

router.post("/change-plan", validate(changePlanSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const { planId, billingCycle, projectId } = req.validatedBody;
  subscriptionDebug(req, "change_plan.start", {
    userId: req.auth.userId,
    planId,
    billingCycle: billingCycle ?? null,
    projectId: projectId ?? null,
  });
  if (!projectId) return res.status(400).json({ error: "project_id_required" });
  const sub = await findUserProjectSubscription(req.auth.userId, projectId, { include: { plan: true } });
  const nextPlan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!sub || !nextPlan) return res.status(404).json({ error: "subscription_or_plan_not_found" });

  if (isPlanOneTimeOnly(nextPlan)) {
    return res.status(400).json({
      error: "plan_requires_one_time_checkout",
      message: "This plan is only available as a one-time purchase via checkout.",
    });
  }

  const preferred = billingCycle ?? sub.billingCycle;
  const cycle = resolveBillingCycleForPlan(nextPlan, preferred === "yearly" ? "yearly" : "monthly");
  if (!planAllowsBillingCycle(nextPlan, cycle)) {
    return res.status(400).json({ error: "billing_cycle_not_available_for_plan" });
  }
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

  if (stripe && sub.stripeSubscriptionId) {
    const newPriceId = cycle === "yearly" ? nextPlan.stripePriceYearlyId : nextPlan.stripePriceMonthlyId;
    if (newPriceId) {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [{ id: stripeSub.items.data[0].id, price: newPriceId }],
        proration_behavior: "create_prorations",
      });
      subscriptionDebug(req, "change_plan.stripe_updated", {
        userId: req.auth.userId,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        newPriceId,
      });
    }
  }

  let updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      planId: nextPlan.id,
      billingCycle: cycle,
      includedCreditsPerPeriod: Math.max(0, nextPlan.includedEditCreditsPerPeriod ?? 0),
      includedCreditsUsedThisPeriod: Math.min(
        sub.includedCreditsUsedThisPeriod ?? 0,
        Math.max(0, nextPlan.includedEditCreditsPerPeriod ?? 0),
      ),
    },
    include: { plan: true },
  });

  if (projectId) {
    try {
      await syncSubscriptionFromStripeForUserId(req.auth.userId, { projectId });
    } catch {
      /* non-fatal */
    }
    const refreshed = await findUserProjectSubscription(req.auth.userId, projectId, { include: { plan: true } });
    if (refreshed) updated = refreshed;
    await prisma.project.updateMany({
      where: { id: projectId, ownerUserId: req.auth.userId },
      data: {
        planId: updated.planId,
        planName: updated.plan?.name ?? nextPlan.name,
        billingCycle: updated.billingCycle,
        planValidUntil: updated.currentPeriodEnd,
        subscriptionStatus: "active",
      },
    });
  }
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
  subscriptionDebug(req, "change_plan.success", {
    userId: req.auth.userId,
    previousPlanId: sub.planId,
    nextPlanId: nextPlan.id,
    billingCycle: cycle,
    prorationNetCents: proration.netCents,
  });
  return res.json({ subscription: updated, proration });
});

router.post("/cancel", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const projectId = String(req.body?.projectId ?? "").trim();
  if (!projectId) return res.status(400).json({ error: "project_id_required" });
  const sub = await findUserProjectSubscription(req.auth.userId, projectId);
  subscriptionDebug(req, "cancel.start", {
    userId: req.auth.userId,
    subscriptionId: sub?.id ?? null,
    projectId,
  });
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

  subscriptionDebug(req, "cancel.success", { userId: req.auth.userId, subscriptionId: updated.id });
  return res.json(updated);
});

router.post("/pause", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const projectId = String(req.body?.projectId ?? "").trim();
  if (!projectId) return res.status(400).json({ error: "project_id_required" });
  const sub = await findUserProjectSubscription(req.auth.userId, projectId);
  subscriptionDebug(req, "pause.start", {
    userId: req.auth.userId,
    subscriptionId: sub?.id ?? null,
    projectId,
  });
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
  subscriptionDebug(req, "pause.success", { userId: req.auth.userId, subscriptionId: updated.id });
  return res.json(updated);
});

router.post("/resume", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const projectId = String(req.body?.projectId ?? "").trim();
  if (!projectId) return res.status(400).json({ error: "project_id_required" });
  const sub = await findUserProjectSubscription(req.auth.userId, projectId);
  subscriptionDebug(req, "resume.start", {
    userId: req.auth.userId,
    subscriptionId: sub?.id ?? null,
    projectId,
  });
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
  subscriptionDebug(req, "resume.success", { userId: req.auth.userId, subscriptionId: updated.id });
  return res.json(updated);
});

router.post("/payment-method", validate(paymentMethodSchema), async (req, res) => {
  return res.json({ ok: true, message: "use_stripe_billing_portal_for_cards", last4: req.validatedBody.last4 });
});

router.post("/checkout-session", validate(checkoutSessionSchema), async (req, res) => {
  assertStripeConfigured();
  const {
    planId,
    billingCycle: billingCycleRaw = "monthly",
    addons: addonsRaw = [],
    projectId,
    successUrl: successUrlOverride,
    cancelUrl: cancelUrlOverride,
  } = req.validatedBody;
  const requestedCycle = billingCycleRaw === "yearly" ? "yearly" : "monthly";
  subscriptionDebug(req, "checkout_session.start", {
    userId: req.auth.userId,
    planId,
    billingCycle: requestedCycle,
    projectId: projectId ?? null,
    requestedAddonCount: addonsRaw.length,
    hasSuccessUrlOverride: Boolean(successUrlOverride),
    hasCancelUrlOverride: Boolean(cancelUrlOverride),
  });
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerUserId: req.auth.userId } });
  if (!project) return res.status(404).json({ error: "project_not_found" });
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return res.status(404).json({ error: "plan_not_found" });
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

  const requestedAddonCodes = Array.from(
    new Set((addonsRaw ?? []).map((c) => String(c ?? "").trim()).filter(Boolean)),
  );
  const addonRows =
    requestedAddonCodes.length === 0
      ? []
      : await prisma.subscriptionAddon.findMany({
          where: { code: { in: requestedAddonCodes }, isActive: true },
        });
  if (addonRows.length !== requestedAddonCodes.length) {
    return res.status(400).json({ error: "unknown_or_inactive_addon" });
  }
  const normalizedAddons = requestedAddonCodes.filter((c) => addonRows.some((r) => r.code === c));

  if (isPlanOneTimeOnly(plan)) {
    const badAddon = addonRows.some((r) => !isAddonOneTimeStyle(r));
    if (badAddon) {
      return res.status(400).json({
        error: "recurring_addons_not_allowed_with_one_time_plan",
        message: "One-time plans only support add-ons marked as one-time (both monthly and yearly disabled).",
      });
    }
    const lineItems = [
      {
        price_data: {
          currency: plan.currency.toLowerCase(),
          product_data: { name: `${plan.name} (one-time)` },
          unit_amount: plan.priceMonthlyCents,
        },
        quantity: 1,
      },
      ...addonRows.map((r) => ({
        price_data: {
          currency: plan.currency.toLowerCase(),
          product_data: { name: r.label },
          unit_amount: r.priceCents,
        },
        quantity: 1,
      })),
    ];
    const checkoutMetadata = {
      userId: req.auth.userId,
      planId: plan.id,
      billingCycle: "monthly",
      addons: normalizedAddons.join(","),
      checkoutKind: "plan_one_time",
      ...(projectId ? { projectId } : {}),
    };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: req.auth.userId,
      customer_email: req.auth.email,
      line_items: lineItems,
      success_url: checkoutSuccessUrl,
      cancel_url: cancelUrl,
      metadata: checkoutMetadata,
    });
    metricsBilling.checkoutSessionCreated();
    subscriptionDebug(req, "checkout_session.success", {
      userId: req.auth.userId,
      planId,
      billingCycle: "one_time",
      projectId: projectId ?? null,
      normalizedAddonCount: normalizedAddons.length,
      sessionId: session.id,
    });
    return res.json({ url: session.url });
  }

  const effectiveCycle = resolveBillingCycleForPlan(plan, requestedCycle);
  if (!planAllowsBillingCycle(plan, effectiveCycle)) {
    return res.status(400).json({ error: "billing_cycle_not_available_for_plan" });
  }
  for (const row of addonRows) {
    if (!addonAllowedOnSubscriptionCycle(row, effectiveCycle)) {
      return res.status(400).json({ error: "addon_not_available_for_billing_cycle", code: row.code });
    }
  }

  const stripePriceId = effectiveCycle === "yearly" ? plan.stripePriceYearlyId : plan.stripePriceMonthlyId;
  const planAmountCents = effectiveCycle === "yearly" ? plan.priceYearlyCents : plan.priceMonthlyCents;
  let planLineItem = null;
  if (stripePriceId) {
    try {
      await stripe.prices.retrieve(stripePriceId);
      planLineItem = { price: stripePriceId, quantity: 1 };
    } catch (e) {
      const msg = String(e?.message ?? "");
      if (!msg.includes("No such price")) throw e;
      log.warn("checkout_session.price_mapping_stale_fallback", {
        userId: req.auth.userId,
        planId: plan.id,
        billingCycle: effectiveCycle,
        stripePriceId,
      });
    }
  }
  if (!planLineItem) {
    planLineItem = {
      price_data: {
        currency: plan.currency.toLowerCase(),
        product_data: { name: `${plan.name} (${effectiveCycle})` },
        recurring: { interval: effectiveCycle === "yearly" ? "year" : "month" },
        unit_amount: planAmountCents,
      },
      quantity: 1,
    };
  }
  const addonCatalog = new Map(addonRows.map((row) => [row.code, row]));
  const addonLineItems = normalizedAddons.flatMap((code) => {
    const row = addonCatalog.get(code);
    if (!row) return [];
    return buildSubscriptionCheckoutAddonLineItems(plan.currency, effectiveCycle, row);
  });
  const checkoutMetadata = {
    userId: req.auth.userId,
    planId: plan.id,
    billingCycle: effectiveCycle,
    addons: normalizedAddons.join(","),
    ...(plan.stripeProductId ? { stripeProductId: plan.stripeProductId } : {}),
    ...(projectId ? { projectId } : {}),
  };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: req.auth.userId,
    customer_email: req.auth.email,
    line_items: [planLineItem, ...addonLineItems],
    success_url: checkoutSuccessUrl,
    cancel_url: cancelUrl,
    metadata: checkoutMetadata,
    subscription_data: {
      metadata: checkoutMetadata,
    },
  });
  metricsBilling.checkoutSessionCreated();
  subscriptionDebug(req, "checkout_session.success", {
    userId: req.auth.userId,
    planId,
    billingCycle: effectiveCycle,
    projectId: projectId ?? null,
    normalizedAddonCount: normalizedAddons.length,
    sessionId: session.id,
  });
  return res.json({ url: session.url });
});

function parseCreditPackGrantOverridesFromMeta(meta) {
  const raw = meta?.creditPackGrants;
  if (!raw || typeof raw !== "string" || String(raw).trim() === "") return {};
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === "object" && !Array.isArray(o)) return o;
  } catch {
    // ignore invalid JSON
  }
  return {};
}

function resolveCreditPackGrantWithOverrides(plan, addonRow, overrides) {
  const code = addonRow?.code;
  if (code === EXTRA_EDIT_SINGLE_CODE) {
    const raw = overrides?.[EXTRA_EDIT_SINGLE_CODE];
    const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
    if (Number.isFinite(n) && n > 0 && n <= 500) return Math.floor(n);
  }
  return resolveCreditPackGrantForAddon(plan, addonRow);
}

/** One-time payment for add-on(s) on an existing project subscription; merges codes into `project.addonsJson`. */
router.post("/addon-checkout-session", validate(addonCheckoutSessionSchema), async (req, res) => {
  assertStripeConfigured();
  const {
    projectId,
    addonCodes: rawCodes,
    successUrl: successUrlOverride,
    cancelUrl: cancelUrlOverride,
    extraEditCheckout,
    addonRecurringCycle,
  } = req.validatedBody;
  subscriptionDebug(req, "addon_checkout_session.start", {
    userId: req.auth.userId,
    projectId,
    requestedAddonCount: rawCodes.length,
  });
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerUserId: req.auth.userId } });
  if (!project) return res.status(404).json({ error: "project_not_found" });
  const sub = await findUserProjectSubscription(req.auth.userId, projectId, { include: { plan: true } });
  if (!sub || !["active", "trialing"].includes(sub.status)) {
    return res.status(409).json({ error: "subscription_not_active" });
  }
  let stripeCustomerId = sub.stripeCustomerId?.trim() || null;
  if (!stripeCustomerId) {
    let resolved;
    try {
      resolved = await resolveOrCreateStripeCustomerId(req.auth.userId, sub);
    } catch (e) {
      log.error("addon_checkout_session.customer_resolve_failed", {
        userId: req.auth.userId,
        projectId,
        error: e?.message,
      });
      return res.status(503).json({
        error: "billing_setup_failed",
        message: "Could not prepare billing for checkout. Please try again.",
      });
    }
    if (!resolved.ok) {
      return res.status(400).json({
        error: resolved.reason ?? "missing_stripe_customer",
        message:
          resolved.message ??
          "Billing profile could not be set up. Complete subscription checkout or contact support.",
      });
    }
    stripeCustomerId = resolved.customerId;
  }
  const existing = Array.isArray(project.addonsJson) ? project.addonsJson.filter((v) => typeof v === "string") : [];
  const addonCatalogRows = await fetchSubscriptionAddonCatalog();
  const addonByCode = new Map(addonCatalogRows.map((r) => [r.code, r]));
  const requested = Array.from(
    new Set(
      rawCodes
        .map((c) => String(c ?? "").trim())
        .filter((c) => {
          const row = addonByCode.get(c);
          if (!row) return false;
          if (isRepeatableExtraEditPurchase(row)) return true;
          return !existing.includes(c);
        }),
    ),
  );
  if (requested.length === 0) {
    return res.status(400).json({ error: "no_new_addons_to_purchase" });
  }
  const plan = sub.plan;
  if (!plan) {
    return res.status(409).json({
      error: "subscription_plan_missing",
      message: "Cannot price add-ons without a plan on this subscription.",
    });
  }
  for (const code of requested) {
    const row = addonByCode.get(code);
    if (!addonEligibleForPlan(row, plan)) {
      return res.status(400).json({ error: "addon_not_eligible_for_plan", code });
    }
    if (isPlanPricedExtraEditAddonCode(code)) {
      const v = validateExtraEditAddonAgainstPlan(plan, row);
      if (!v.ok) return res.status(400).json({ error: v.error, message: v.message });
    }
  }

  const subBillingCycle = sub.billingCycle === "yearly" ? "yearly" : "monthly";
  const recurringCodes = requested.filter((c) => isRecurringAddonRow(addonByCode.get(c)));
  if (recurringCodes.length > 1) {
    return res.status(400).json({
      error: "single_recurring_addon_checkout",
      message: "Purchase one recurring add-on at a time.",
    });
  }
  const recurringCode = recurringCodes[0] ?? null;
  let recurringChosenCycle = null;
  if (recurringCode) {
    const row = addonByCode.get(recurringCode);
    recurringChosenCycle = resolveChosenAddonRecurringCycle(
      subBillingCycle,
      row,
      addonRecurringCycle,
    );
    if (!recurringChosenCycle) {
      return res.status(400).json({
        error: "addon_recurring_cycle_unavailable",
        message: "This add-on is not available on the selected billing interval.",
        code: recurringCode,
      });
    }
    const attachStrategy = resolveRecurringAddonAttachStrategy(
      subBillingCycle,
      recurringChosenCycle,
    );
    if (attachStrategy === "same_subscription" && !sub.stripeSubscriptionId) {
      return res.status(400).json({
        error: "missing_stripe_subscription",
        message: "Cannot attach a recurring add-on without a Stripe subscription id.",
      });
    }
  }

  const hasSingle = requested.includes(EXTRA_EDIT_SINGLE_CODE);
  const hasBundle = requested.includes(EXTRA_EDIT_BUNDLE_CODE);
  if (hasSingle && hasBundle) {
    return res.status(400).json({
      error: "extra_edit_mix_not_allowed",
      message: "Purchase per-edit credits or a fixed bundle in a single checkout, not both.",
    });
  }

  /** @type {Record<string, number>} */
  let creditPackOverrides = {};
  if (hasSingle) {
    if (extraEditCheckout?.mode === "bundle") {
      return res.status(400).json({
        error: "extra_edit_checkout_invalid",
        message: "Per-edit checkout options do not apply to the bundle add-on.",
      });
    }
    const qRaw =
      extraEditCheckout?.mode === "per_edit" ? extraEditCheckout.perEditQuantity ?? 1 : 1;
    const q = Math.floor(Number(qRaw));
    if (!Number.isFinite(q) || q < 1 || q > 500) {
      return res.status(400).json({
        error: "extra_edit_invalid_quantity",
        message: "Enter a number of edits between 1 and 500.",
      });
    }
    creditPackOverrides[EXTRA_EDIT_SINGLE_CODE] = q;
  } else if (hasBundle) {
    if (extraEditCheckout?.mode === "per_edit") {
      return res.status(400).json({
        error: "extra_edit_checkout_invalid",
        message: "Use the bundle option when purchasing the edit bundle add-on.",
      });
    }
  }

  let purchasedDelta = 0;
  for (const code of requested) {
    const row = addonByCode.get(code);
    const effect = readAddonEffectKind(row.catalogJson);
    if (effect === "credit_pack") {
      purchasedDelta += resolveCreditPackGrantWithOverrides(plan, row, creditPackOverrides);
    }
  }
  const currency = (plan.currency ?? addonByCode.get(requested[0])?.currency ?? "USD").toLowerCase();
  const successUrl = successUrlOverride ?? env.stripeSuccessUrl;
  const cancelUrl = cancelUrlOverride ?? env.stripeCancelUrl;
  if (!isAllowedRedirect(successUrl) || !isAllowedRedirect(cancelUrl)) {
    return res.status(400).json({
      error: "invalid_redirect_url",
      message: "Redirect URL is not in the allowed origin list.",
    });
  }
  const u = new URL(successUrl);
  u.searchParams.set("subscriptionFunnel", "addon_checkout_return");
  u.searchParams.set("projectId", projectId);
  const qs = u.searchParams.toString();
  const checkoutSuccessUrl = `${u.origin}${u.pathname}?${qs}&session_id={CHECKOUT_SESSION_ID}${u.hash || ""}`;

  let attachRecurringAddonJson = "";
  const lineItems = [];
  const attachEntries = [];

  if (recurringCode) {
    const item = addonByCode.get(recurringCode);
    const firstPeriodCents = recurringAddonFirstCheckoutCents(
      item,
      plan,
      recurringChosenCycle,
    );
    if (firstPeriodCents <= 0) {
      return res.status(400).json({ error: "invalid_addon_price", code: recurringCode });
    }
    const setup = item.setupFeeCents ?? 0;
    const labelSuffix =
      setup > 0 ? " (setup + first billing cycle)" : " (first billing cycle)";
    lineItems.push({
      price_data: {
        currency,
        product_data: { name: `${item.label}${labelSuffix}` },
        unit_amount: firstPeriodCents,
      },
      quantity: 1,
    });
    attachEntries.push(buildRecurringAttachEntry(item, plan, recurringChosenCycle, subBillingCycle));
  }

  for (const code of requested) {
    if (recurringCode && code === recurringCode) continue;
    const item = addonByCode.get(code);
    const unit = resolveAddonPlanPriceCents(plan, item, subBillingCycle);
    if (unit <= 0) {
      return res.status(400).json({ error: "invalid_addon_price", code });
    }
    const qty =
      code === EXTRA_EDIT_SINGLE_CODE && creditPackOverrides[EXTRA_EDIT_SINGLE_CODE]
        ? creditPackOverrides[EXTRA_EDIT_SINGLE_CODE]
        : 1;
    lineItems.push({
      price_data: {
        currency,
        product_data: { name: `${item.label} (add-on)` },
        unit_amount: unit,
      },
      quantity: qty,
    });
  }

  if (attachEntries.length > 0) {
    attachRecurringAddonJson = JSON.stringify(attachEntries);
  }

  const checkoutMetadata = {
    userId: req.auth.userId,
    projectId,
    kind: "project_addon_payment",
    addonCodes: requested.join(","),
    planIdSnapshot: plan.id,
    ...(Object.keys(creditPackOverrides).length > 0
      ? { creditPackGrants: JSON.stringify(creditPackOverrides) }
      : {}),
    ...(attachRecurringAddonJson ? { attachRecurringAddonJson } : {}),
  };
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
    line_items: lineItems,
    success_url: checkoutSuccessUrl,
    cancel_url: cancelUrl,
    metadata: checkoutMetadata,
    payment_intent_data: {
      metadata: checkoutMetadata,
    },
  });
  subscriptionDebug(req, "addon_checkout_session.success", {
    userId: req.auth.userId,
    projectId,
    sessionId: session.id,
    addonCodes: requested,
  });
  return res.json({ url: session.url });
});

router.post("/confirm-addon-checkout", validate(confirmAddonCheckoutSchema), async (req, res) => {
  assertStripeConfigured();
  const { sessionId, projectId } = req.validatedBody;
  subscriptionDebug(req, "addon_checkout_confirm.start", { userId: req.auth.userId, projectId, sessionId });
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerUserId: req.auth.userId } });
  if (!project) return res.status(404).json({ error: "project_not_found" });
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
  } catch (e) {
    return res.status(400).json({ error: "invalid_session", message: e?.message ?? "Could not load checkout session." });
  }
  if (session.mode !== "payment") return res.status(400).json({ error: "wrong_session_mode" });
  if (session.payment_status !== "paid") {
    return res.status(409).json({ error: "payment_not_complete", status: session.payment_status });
  }
  const meta = session.metadata ?? {};
  if (String(meta.userId ?? "") !== req.auth.userId || String(meta.projectId ?? "") !== projectId) {
    return res.status(403).json({ error: "session_metadata_mismatch" });
  }
  if (String(meta.kind ?? "") !== "project_addon_payment") {
    return res.status(400).json({ error: "wrong_session_kind" });
  }
  const grantOverrides = parseCreditPackGrantOverridesFromMeta(meta);
  const codes = String(meta.addonCodes ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (codes.length === 0) return res.status(400).json({ error: "missing_addon_codes" });
  const addonCatalogRows = await prisma.subscriptionAddon.findMany({
    where: { isActive: true, code: { in: codes } },
  });
  const valid = new Set(addonCatalogRows.map((r) => r.code));
  const normalized = codes.filter((c) => valid.has(c));
  const dedupeId = `stripe_session_${sessionId}`;
  const invoices = Array.isArray(project.invoicesJson) ? project.invoicesJson : [];
  if (invoices.some((inv) => inv && inv.id === dedupeId)) {
    subscriptionDebug(req, "addon_checkout_confirm.idempotent", { userId: req.auth.userId, projectId, sessionId });
    const ls = await prisma.subscription.findFirst({
      where: { userId: req.auth.userId, projectId },
      select: {
        id: true,
        stripeSubscriptionId: true,
        stripeCustomerId: true,
        billingCycle: true,
        currentPeriodStart: true,
        plan: true,
      },
    });
    const idempotentCustomerId =
      (typeof session.customer === "string" ? session.customer : session.customer?.id) ??
      (ls ? await resolveStripeCustomerIdForSubscription(req.auth.userId, ls) : null);
    const attachRes = await attachRecurringAddonIfNeeded(meta, ls, addonCatalogRows, session, {
      projectId,
      userId: req.auth.userId,
      stripeCustomerId: idempotentCustomerId,
    });
    if (!attachRes.ok) {
      subscriptionDebug(req, "addon_checkout_confirm.idempotent_attach_pending", {
        projectId,
        message: attachRes.message,
      });
      return res.status(502).json({
        ...attachFailureResponse(attachRes),
        alreadyProcessed: true,
        canRetry: true,
      });
    }
    return res.json({ ok: true, alreadyProcessed: true });
  }
  const existing = Array.isArray(project.addonsJson) ? project.addonsJson.filter((v) => typeof v === "string") : [];
  const merged = Array.from(new Set([...existing, ...normalized]));

  const localSub = await prisma.subscription.findFirst({
    where: { userId: req.auth.userId, projectId },
    select: {
      id: true,
      currentPeriodEnd: true,
      supportPriorityBoostUntil: true,
      purchasedCreditsBalance: true,
      includedCreditsPerPeriod: true,
      includedCreditsUsedThisPeriod: true,
      stripeSubscriptionId: true,
      billingCycle: true,
      planId: true,
      plan: true,
    },
  });

  if (meta.planIdSnapshot && localSub?.planId && String(meta.planIdSnapshot) !== String(localSub.planId)) {
    return res.status(409).json({
      error: "plan_changed_since_checkout",
      message: "Your subscription plan changed during checkout. Please start again.",
    });
  }

  let purchasedDelta = 0;
  for (const code of normalized) {
    const row = addonCatalogRows.find((r) => r.code === code);
    if (!row) continue;
    const effect = readAddonEffectKind(row.catalogJson);
    if (effect === "credit_pack") {
      purchasedDelta += resolveCreditPackGrantWithOverrides(localSub?.plan, row, grantOverrides);
    }
  }
  if (purchasedDelta > 0 && !localSub) {
    return res.status(409).json({
      error: "subscription_required_for_credit_pack",
      message: "Credit packs require an active project subscription row.",
    });
  }
  if (meta.attachRecurringAddonJson) {
    const attachEntries = parseAttachRecurringEntries(meta);
    const needsPlanSub = attachEntries.some((entry) => {
      const chosen = entry.chosenCycle === "yearly" ? "yearly" : "monthly";
      const strategy =
        entry.attachStrategy === "separate_subscription" ||
        entry.attachStrategy === "same_subscription"
          ? entry.attachStrategy
          : resolveRecurringAddonAttachStrategy(localSub?.billingCycle ?? "monthly", chosen);
      return strategy === "same_subscription";
    });
    if (needsPlanSub && !localSub?.stripeSubscriptionId) {
      return res.status(409).json({
        error: "missing_stripe_subscription",
        message: "Cannot finalize this add-on without a Stripe subscription on file.",
      });
    }
  }

  const stripeCustomerIdForAttach =
    (typeof session.customer === "string" ? session.customer : session.customer?.id) ??
    (localSub
      ? await resolveStripeCustomerIdForSubscription(req.auth.userId, localSub)
      : null);

  if (meta.attachRecurringAddonJson) {
    const attachRes = await attachRecurringAddonIfNeeded(meta, localSub, addonCatalogRows, session, {
      projectId,
      userId: req.auth.userId,
      stripeCustomerId: stripeCustomerIdForAttach,
    });
    if (!attachRes.ok) {
      return res.status(502).json(attachFailureResponse(attachRes));
    }
  }

  const amountCents =
    typeof session.amount_total === "number" && session.amount_total >= 0
      ? session.amount_total
      : normalized.reduce((sum, code) => {
          const row = addonCatalogRows.find((r) => r.code === code);
          return sum + (row?.priceCents ?? 0);
        }, 0);
  const currency = String(
    session.currency ?? addonCatalogRows.find((r) => r.code === normalized[0])?.currency ?? "USD",
  ).toUpperCase();
  const invoiceNumber = `ADD-${String(invoices.length + 1).padStart(4, "0")}`;
  const nextInvoices = [
    {
      id: dedupeId,
      invoiceNumber,
      amountCents,
      currency,
      status: "succeeded",
      paidAt: new Date().toISOString(),
    },
    ...invoices,
  ];

  try {
    await prisma.$transaction(async (tx) => {
      for (const code of normalized) {
        const row = addonCatalogRows.find((r) => r.code === code);
        if (!row) continue;
        const effect = readAddonEffectKind(row.catalogJson);
        if (row.billingKind === "one_time" && effect === "consumable_service") {
          await tx.projectAddonEntitlement.create({
            data: {
              projectId,
              subscriptionAddonId: row.id,
              checkoutDedupeKey: `${dedupeId}:${code}`,
            },
          });
        }
      }
      if (purchasedDelta > 0 && localSub) {
        await tx.subscription.update({
          where: { id: localSub.id },
          data: { purchasedCreditsBalance: { increment: purchasedDelta } },
        });
      }
      let mergedBoostUntil = null;
      for (const code of normalized) {
        const row = addonCatalogRows.find((r) => r.code === code);
        if (!row) continue;
        const effect = readAddonEffectKind(row.catalogJson);
        if (effect === "priority_boost" && localSub) {
          const candidate = localSub.currentPeriodEnd;
          const prev = mergedBoostUntil ?? localSub.supportPriorityBoostUntil;
          mergedBoostUntil =
            !prev || new Date(candidate) > new Date(prev) ? candidate : prev;
        }
      }
      if (mergedBoostUntil && localSub) {
        await tx.subscription.update({
          where: { id: localSub.id },
          data: { supportPriorityBoostUntil: mergedBoostUntil },
        });
      }
      await tx.project.update({
        where: { id: project.id },
        data: { addonsJson: merged, invoicesJson: nextInvoices },
      });
    });
  } catch (e) {
    if (e?.code === "P2002") {
      subscriptionDebug(req, "addon_checkout_confirm.idempotent_unique", { userId: req.auth.userId, projectId, sessionId });
      return res.json({ ok: true, alreadyProcessed: true });
    }
    throw e;
  }
  subscriptionDebug(req, "addon_checkout_confirm.success", { userId: req.auth.userId, projectId, addonCodes: normalized });
  return res.json({ ok: true });
});

/** Ensures a Stripe customer exists for add-on checkout / billing portal (idempotent). */
router.post("/ensure-billing-customer", validate(projectSubscriptionActionSchema), async (req, res) => {
  assertStripeConfigured();
  const projectId = req.validatedBody.projectId;
  subscriptionDebug(req, "ensure_billing_customer.start", { userId: req.auth.userId, projectId });
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerUserId: req.auth.userId } });
  if (!project) return res.status(404).json({ error: "project_not_found" });
  const sub = await findUserProjectSubscription(req.auth.userId, projectId);
  if (!sub || !["active", "trialing"].includes(sub.status)) {
    return res.status(409).json({ error: "subscription_not_active" });
  }
  if (sub.stripeCustomerId?.trim()) {
    return res.json({ ok: true, customerId: sub.stripeCustomerId.trim() });
  }
  let resolved;
  try {
    resolved = await resolveOrCreateStripeCustomerId(req.auth.userId, sub);
  } catch (e) {
    log.error("ensure_billing_customer.resolve_failed", {
      userId: req.auth.userId,
      projectId,
      error: e?.message,
    });
    return res.status(503).json({
      error: "billing_setup_failed",
      message: "Could not prepare billing. Please try again.",
    });
  }
  if (!resolved.ok) {
    return res.status(400).json({
      error: resolved.reason ?? "missing_stripe_customer",
      message: resolved.message ?? "Could not set up billing for this project.",
    });
  }
  subscriptionDebug(req, "ensure_billing_customer.success", {
    userId: req.auth.userId,
    projectId,
    customerId: resolved.customerId,
  });
  return res.json({ ok: true, customerId: resolved.customerId });
});

router.post("/billing-portal", validate(billingPortalSchema), async (req, res) => {
  assertStripeConfigured();
  const projectId = req.validatedBody.projectId ?? null;
  subscriptionDebug(req, "billing_portal.start", { userId: req.auth.userId, projectId });
  const sub = projectId
    ? await findUserProjectSubscription(req.auth.userId, projectId)
    : await findPrimaryUserSubscription(req.auth.userId);
  if (!sub) return res.status(404).json({ error: "subscription_not_found" });
  let portalCustomerId = sub.stripeCustomerId?.trim() || null;
  if (!portalCustomerId) {
    const resolved = await resolveOrCreateStripeCustomerId(req.auth.userId, sub);
    if (!resolved.ok) {
      return res.status(400).json({
        error: "missing_stripe_customer",
        message:
          resolved.message ??
          "Billing profile could not be set up. Complete subscription checkout or contact support.",
      });
    }
    portalCustomerId = resolved.customerId;
  }
  const returnUrl = req.validatedBody.returnUrl ?? `${env.appUrl}/billing`;
  if (!isAllowedRedirect(returnUrl)) {
    return res.status(400).json({
      error: "invalid_redirect_url",
      message: "Redirect URL is not in the allowed origin list.",
    });
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: portalCustomerId,
    return_url: returnUrl,
  });
  subscriptionDebug(req, "billing_portal.success", { userId: req.auth.userId, sessionId: session.id });
  return res.json({ url: session.url });
});

router.post("/stop-recurring", validate(projectSubscriptionActionSchema), async (req, res) => {
  const projectId = req.validatedBody.projectId;
  const sub = await findUserProjectSubscription(req.auth.userId, projectId);
  if (!sub) return res.status(404).json({ error: "subscription_not_found" });
  if (sub.status === "canceled") return res.status(400).json({ error: "subscription_canceled" });
  if (stripe && sub.stripeSubscriptionId) {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
  }
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: true },
  });
  return res.json(updated);
});

router.post("/resume-recurring", validate(projectSubscriptionActionSchema), async (req, res) => {
  const projectId = req.validatedBody.projectId;
  const sub = await findUserProjectSubscription(req.auth.userId, projectId);
  if (!sub) return res.status(404).json({ error: "subscription_not_found" });
  if (sub.status === "canceled") return res.status(400).json({ error: "subscription_canceled" });
  if (stripe && sub.stripeSubscriptionId) {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
  }
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: false },
  });
  return res.json(updated);
});

/* ------------- Admin ------------- */
const adminRouter = express.Router();
adminRouter.use(requireAuth, requireRole("admin", "master_admin"));
adminRouter.use("/plans", requireModuleAccess("plans"));
adminRouter.use("/addons", requireModuleAccess("plans"));
adminRouter.use("/edit-types", requireModuleAccess("plans"));
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
      billingMonthlyEnabled: p.billingMonthlyEnabled ?? true,
      billingYearlyEnabled: p.billingYearlyEnabled ?? true,
      includedEditCreditsPerPeriod: p.includedEditCreditsPerPeriod ?? 0,
      catalogJson: p.catalogJson && typeof p.catalogJson === "object" ? p.catalogJson : {},
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
  const body = { ...req.validatedBody };
  let data = body;
  if (body.catalogJson !== undefined) {
    const existing = await prisma.plan.findUnique({
      where: { id: req.params.id },
      select: { catalogJson: true },
    });
    try {
      data = {
        ...body,
        catalogJson: mergePlanWebsiteCatalogJson(existing?.catalogJson, body.catalogJson),
      };
    } catch (e) {
      if (e instanceof ZodError) {
        return res.status(400).json({ error: "invalid_plan_catalog", issues: e.flatten() });
      }
      throw e;
    }
  }
  const updated = await prisma.plan.update({ where: { id: req.params.id }, data });
  await logAuditEvent({
    action: "admin.plan_updated",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "plan",
    targetId: updated.id,
    metadata: { patchKeys: Object.keys(data ?? {}) },
    ...auditCtx,
  });
  if (stripe && planPatchTriggersCatalogSync(body)) {
    schedulePlanCatalogSync(updated.id, {
      triggeredBy: "admin_plan_patch",
      migrateSubscriptions: true,
      prorationBehavior: "none",
    });
  }
  return res.json(updated);
});

adminRouter.post("/plans/:id/sync-stripe-catalog", validate(planCatalogSyncSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
  if (!plan) return res.status(404).json({ error: "plan_not_found" });
  try {
    assertStripeConfigured();
  } catch {
    return res.status(503).json({ error: "stripe_not_configured" });
  }
  const result = await runPlanCatalogSync(plan.id, {
    triggeredBy: "admin_manual",
    migrateSubscriptions: req.validatedBody.migrateSubscriptions ?? true,
    prorationBehavior: req.validatedBody.prorationBehavior ?? "none",
  });
  await logAuditEvent({
    action: "admin.plan_stripe_catalog_sync",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "plan",
    targetId: plan.id,
    metadata: {
      ok: result.ok,
      catalogChanged: result.catalog?.catalogChanged ?? false,
      migrationUpdated: result.migration?.updated ?? 0,
    },
    ...auditCtx,
  });
  if (!result.ok) {
    return res.status(result.reason === "stripe_not_configured" ? 503 : 400).json(result);
  }
  const refreshed = await prisma.plan.findUnique({ where: { id: plan.id } });
  return res.json({ plan: refreshed, sync: result });
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

adminRouter.get("/addons", async (_req, res) => {
  return res.json(await fetchAllSubscriptionAddons());
});

adminRouter.post("/addons", validate(addonSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const body = req.validatedBody;
  const created = await prisma.subscriptionAddon.create({
    data: {
      code: body.code.trim(),
      label: body.label.trim(),
      desc: body.desc?.trim() ?? "",
      priceCents: body.priceCents,
      currency: (body.currency ?? "USD").toUpperCase(),
      isActive: body.isActive ?? true,
      billingMonthlyEnabled: body.billingMonthlyEnabled ?? true,
      billingYearlyEnabled: body.billingYearlyEnabled ?? true,
      billingKind: body.billingKind ?? "recurring",
      priceMinCents: body.priceMinCents ?? null,
      priceMaxCents: body.priceMaxCents ?? null,
      setupFeeCents: body.setupFeeCents ?? 0,
      deliveryMode: body.deliveryMode?.trim() ?? "",
      eligiblePlanCodes: Array.isArray(body.eligiblePlanCodes) ? body.eligiblePlanCodes : [],
      catalogJson: body.catalogJson && typeof body.catalogJson === "object" ? body.catalogJson : {},
    },
  });
  await logAuditEvent({
    action: "admin.addon_created",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "subscription_addon",
    targetId: created.id,
    metadata: { code: created.code, priceCents: created.priceCents },
    ...auditCtx,
  });
  return res.status(201).json(created);
});

adminRouter.patch("/addons/:id", validate(addonPatchSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const body = req.validatedBody;
  const data = { ...body };
  if (typeof data.desc === "string") data.desc = data.desc.trim();
  if (typeof data.deliveryMode === "string") data.deliveryMode = data.deliveryMode.trim();
  const updated = await prisma.subscriptionAddon.update({
    where: { id: req.params.id },
    data,
  });
  await logAuditEvent({
    action: "admin.addon_updated",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "subscription_addon",
    targetId: updated.id,
    metadata: { patchKeys: Object.keys(body ?? {}) },
    ...auditCtx,
  });
  return res.json(updated);
});

adminRouter.get("/edit-types", async (_req, res) => {
  const rows = await prisma.editType.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return res.json(rows);
});

adminRouter.patch("/edit-types/:id", validate(editTypePatchSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const body = req.validatedBody;
  const data = { ...body };
  if (typeof data.label === "string") data.label = data.label.trim();
  const updated = await prisma.editType.update({
    where: { id: req.params.id },
    data,
  });
  await logAuditEvent({
    action: "admin.edit_type_updated",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "edit_type",
    targetId: updated.id,
    metadata: { patchKeys: Object.keys(body ?? {}) },
    ...auditCtx,
  });
  return res.json(updated);
});

adminRouter.post("/invites", requireMasterAdmin, validate(createInviteSchema), async (req, res) => {
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
  const paymentUrl = invite.plan ? `${env.appUrl}/subscription?prefillPlan=${encodeURIComponent(invite.plan.code)}` : null;
  const msgHtml = invite.message
    ? `<div style="margin:16px 0;padding:12px;border-radius:8px;background:#111;color:#eee;">${invite.message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>")}</div>`
    : "";
  const planLine = invite.plan ? `<p>Your workspace includes the <strong>${invite.plan.name}</strong> plan.</p>` : "";
  const paymentLine = paymentUrl
    ? `<p>After creating your account, complete payment here: <a href="${paymentUrl}">Open payment page</a></p>`
    : "";
  await sendTransactionalEmail({
    to: emailLower,
    template: "invite",
    idempotencyKey: `invite_${invite.id}`,
    subject: "You are invited to Sitropix",
    html: `<p>You have been invited to create an account.</p>${msgHtml}${planLine}<p><a href="${signupUrl}">Accept invitation</a></p>${paymentLine}<p>This link expires in ${days} days.</p>`,
  });
  return res.status(201).json({ ok: true, id: invite.id, email: emailLower, expiresAt: invite.expiresAt });
});

adminRouter.get("/invites", async (_req, res) => {
  await deleteExpiredPendingInvites();
  const now = new Date();
  const rows = await prisma.invite.findMany({
    where: {
      NOT: {
        AND: [{ acceptedAt: null }, { expiresAt: { lt: now } }],
      },
    },
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

adminRouter.delete("/invites/:id", requireMasterAdmin, async (req, res) => {
  const row = await prisma.invite.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.acceptedAt) return res.status(400).json({ error: "already_accepted" });
  await prisma.invite.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  return res.json({ ok: true });
});

adminRouter.post("/invites/:id/resend", requireMasterAdmin, async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const row = await prisma.invite.findUnique({
    where: { id: req.params.id },
    include: { plan: { select: { name: true, code: true } } },
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
  const paymentUrl = row.plan ? `${env.appUrl}/subscription?prefillPlan=${encodeURIComponent(row.plan.code)}` : null;
  const planLine = row.plan ? `<p>Your workspace includes the <strong>${row.plan.name}</strong> plan.</p>` : "";
  const paymentLine = paymentUrl
    ? `<p>After creating your account, complete payment here: <a href="${paymentUrl}">Open payment page</a></p>`
    : "";
  await sendTransactionalEmail({
    to: row.email,
    template: "invite",
    idempotencyKey: `invite_resend_${row.id}_${Date.now()}`,
    subject: "Your Sitropix invite link",
    html: `<p>Your invitation link has been re-sent.</p>${planLine}<p><a href="${signupUrl}">Accept invitation</a></p>${paymentLine}`,
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
  const [user, projects, tickets, documents, transactions, revenue] = await Promise.all([
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
    prisma.project.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        subscriptions: {
          take: 1,
          orderBy: { updatedAt: "desc" },
          include: { plan: true },
        },
      },
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

  const projectRows = projects.map((p) => {
    const sub = p.subscriptions[0] ?? null;
    return {
      projectId: p.id,
      projectName: p.name,
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            billingCycle: sub.billingCycle,
            plan: sub.plan
              ? { id: sub.plan.id, code: sub.plan.code, name: sub.plan.name }
              : null,
            currentPeriodStart: sub.currentPeriodStart.toISOString(),
            currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
          }
        : null,
    };
  });

  return res.json({
    overview: {
      user,
      projects: projectRows,
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
      createdAt: p.createdAt.toISOString(),
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

adminRouter.post("/customers/:id/password-reset", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
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
    idempotencyKey: `admin_customer_pwd_reset_${user.id}_${Date.now()}`,
    subject: "Password reset",
    html: `<p>Hi ${user.name},</p><p>An administrator requested a password reset for your account.</p><p><a href="${env.appUrl}/reset-password?token=${resetToken}">Set new password</a> (link expires in 2 hours).</p>`,
  });
  await logAuditEvent({
    action: "admin.password_reset_requested_for_customer",
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetType: "user",
    targetId: user.id,
    metadata: { email: user.email },
    ...auditCtx,
  });
  return res.json({ ok: true });
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

adminRouter.get("/email-templates", async (_req, res) => {
  const rows = await prisma.emailTemplate.findMany({ orderBy: { id: "asc" } });
  if (rows.length === 0) {
    await prisma.$transaction(
      DEFAULT_EMAIL_TEMPLATES.map((row) =>
        prisma.emailTemplate.upsert({
          where: { id: row.id },
          update: { name: row.name, subject: row.subject, html: row.html },
          create: row,
        }),
      ),
    );
  }
  const fresh = await prisma.emailTemplate.findMany({ orderBy: { id: "asc" } });
  return res.json(
    fresh.map((r) => ({
      id: r.id,
      name: r.name,
      subject: r.subject,
      html: r.html,
      updatedAt: r.updatedAt,
    })),
  );
});

adminRouter.put("/email-templates/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const name = String(req.body?.name ?? "").trim();
  const subject = String(req.body?.subject ?? "").trim();
  const html = String(req.body?.html ?? "");
  if (!id || !name || !subject || !html.trim()) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  const row = await prisma.emailTemplate.upsert({
    where: { id },
    update: { name, subject, html },
    create: { id, name, subject, html },
  });
  return res.json({
    id: row.id,
    name: row.name,
    subject: row.subject,
    html: row.html,
    updatedAt: row.updatedAt,
  });
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
  if (!out?.sent && !out?.deduped) {
    const isConsole = out?.used === "console" || String(out?.used ?? "").includes("console");
    return res.status(502).json({
      error: "email_delivery_failed",
      message: isConsole
        ? "No outbound email transport is configured (console-only). Set RESEND_API_KEY with EMAIL_PROVIDER=resend, SENDGRID_API_KEY with EMAIL_PROVIDER=sendgrid, SMTP_* with EMAIL_PROVIDER=smtp, or save a provider in Admin → Email."
        : "Test email could not be delivered. Check provider credentials, sender/domain verification, and server logs.",
      to,
      used: out?.used ?? "unknown",
    });
  }
  if (out?.deduped) {
    return res.json({ ok: true, to, used: out.used, deduped: true });
  }
  return res.json({ ok: true, to, used: out.used, delivered: true });
});

adminRouter.get("/system-config", async (req, res) => {
  if (req.auth.role !== "master_admin") return res.status(403).json({ error: "forbidden" });
  return res.json(await getSystemConfigPayload());
});

adminRouter.put("/system-config", validate(systemConfigPutSchema), async (req, res) => {
  if (req.auth.role !== "master_admin") return res.status(403).json({ error: "forbidden" });
  try {
    await saveSystemConfig(req.validatedBody.items ?? []);
    await reloadStripeFromSystemConfig();
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
    where: { role: "user" },
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
      where: { role: { not: "user" } },
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
      where: {
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gte: new Date() },
        invitedRole: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        email: true,
        planId: true,
        invitedRole: true,
        createdAt: true,
        expiresAt: true,
      },
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

adminRouter.post("/user-management/invite", requireMasterAdmin, async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const role = String(req.body?.role ?? "support");
  if (!name || !email.includes("@")) return res.status(400).json({ error: "invalid_input" });
  if (!["manager", "admin", "master_admin", "support"].includes(role)) {
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
      invitedRole: role,
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

adminRouter.post("/user-management/users/:id/deactivate", requireMasterAdmin, async (req, res) => {
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

adminRouter.post("/user-management/users/:id/reactivate", requireMasterAdmin, async (req, res) => {
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

adminRouter.patch("/user-management/users/:id/role", requireMasterAdmin, validate(adminUserRolePatchSchema), async (req, res) => {
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
  if (updated.role !== "user") {
    await ensureStaffModuleAccess(prisma, userId, updated.role);
  }
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

adminRouter.put("/user-management/users/:id/module-access", requireMasterAdmin, validate(adminUserModuleAccessPutSchema), async (req, res) => {
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

adminRouter.post("/user-management/users/:id/password-reset-link", requireMasterAdmin, async (req, res) => {
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

adminRouter.post("/user-management/users/:id/set-password", requireMasterAdmin, validate(adminUserSetPasswordSchema), async (req, res) => {
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
  const category = String(req.query.category ?? "").trim();
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
  else if (category) where.action = { startsWith: `${category}.` };
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
  const category = String(req.query.category ?? "").trim();
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
  else if (category) where.action = { startsWith: `${category}.` };
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
