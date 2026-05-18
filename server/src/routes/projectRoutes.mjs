import express from "express";
import { prisma } from "../db/client.mjs";
import { log } from "../observability/logger.mjs";
import { requireAuth, requireRole } from "../middleware/auth.mjs";
import { stripe } from "../services/stripeService.mjs";
import { syncSubscriptionFromStripeForUserId } from "../services/stripeSubscriptionSync.mjs";
import {
  findPrimaryUserSubscription,
  findUserProjectSubscription,
} from "../services/subscriptionLookup.mjs";
import { fetchSubscriptionAddonCatalog } from "../services/addonCatalogStore.mjs";
import {
  resolveExtraEditPurchaseSummary,
  resolveProjectAccessibleAddons,
} from "../services/projectAccessibleAddons.mjs";

const router = express.Router();
router.use(requireAuth);

function normalizeProject(row) {
  const addons = Array.isArray(row.addonsJson) ? row.addonsJson.filter((v) => typeof v === "string") : [];
  const invoices = Array.isArray(row.invoicesJson) ? row.invoicesJson : [];
  const next = {
    id: row.id,
    ownerUserId: row.ownerUserId,
    name: row.name,
    description: row.description ?? "",
    createdAt: row.createdAt.toISOString(),
    assets: [],
    subscriptionStatus: row.subscriptionStatus,
    planId: row.planId ?? null,
    planName: row.planName ?? null,
    planValidUntil: row.planValidUntil ? row.planValidUntil.toISOString() : null,
    billingCycle: row.billingCycle ?? null,
    addons,
    invoices,
  };
  if (next.subscriptionStatus === "active" && (!next.planId || !next.planValidUntil || new Date(next.planValidUntil).getTime() <= Date.now())) {
    next.subscriptionStatus = "on_hold";
  }
  return next;
}

async function persistNormalizedStatus(projectId, project) {
  await prisma.project.update({
    where: { id: projectId },
    data: {
      subscriptionStatus: project.subscriptionStatus,
    },
  });
}

router.get("/", async (req, res) => {
  const rows = await prisma.project.findMany({
    where: { ownerUserId: req.auth.userId },
    orderBy: { createdAt: "desc" },
  });
  const normalized = rows.map(normalizeProject);
  await Promise.all(
    normalized
      .filter((p, i) => p.subscriptionStatus !== rows[i]?.subscriptionStatus)
      .map((p) => persistNormalizedStatus(p.id, p)),
  );
  return res.json(normalized);
});

router.get("/subscriptions", async (req, res) => {
  const rows = await prisma.subscription.findMany({
    where: { userId: req.auth.userId },
    include: {
      plan: true,
      project: {
        select: { id: true, name: true, subscriptionStatus: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  return res.json(
    rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      projectId: row.projectId,
      project: row.project
        ? {
            id: row.project.id,
            name: row.project.name,
            subscriptionStatus: row.project.subscriptionStatus,
          }
        : null,
      planId: row.planId,
      status: row.status,
      billingCycle: row.billingCycle,
      currentPeriodStart: row.currentPeriodStart,
      currentPeriodEnd: row.currentPeriodEnd,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      pausedAt: row.pausedAt,
      canceledAt: row.canceledAt,
      nextBillingDate: row.currentPeriodEnd,
      plan: row.plan
        ? {
            id: row.plan.id,
            code: row.plan.code,
            name: row.plan.name,
            description: row.plan.description,
            priceMonthlyCents: row.plan.priceMonthlyCents,
            priceYearlyCents: row.plan.priceYearlyCents,
            currency: row.plan.currency,
            features: row.plan.features,
            isActive: row.plan.isActive,
            trialDays: row.plan.trialDays,
          }
        : null,
    })),
  );
});

function summaryFromStripePaymentMethod(pm) {
  if (!pm || typeof pm !== "object" || pm.object !== "payment_method") return null;
  if (pm.type === "card" && pm.card) {
    return {
      brand: String(pm.card.display_brand ?? pm.card.brand ?? "card"),
      last4: pm.card.last4 ?? "????",
      expMonth: pm.card.exp_month ?? 0,
      expYear: pm.card.exp_year ?? 0,
    };
  }
  if (pm.type === "link" && pm.link) {
    return {
      brand: "Link",
      last4: pm.link.email ? String(pm.link.email).slice(-4) : "••••",
      expMonth: 0,
      expYear: 0,
    };
  }
  return null;
}

/** Default payment method attached to this Stripe subscription (card / Link). */
async function fetchSubscriptionPaymentMethodSummary(stripeSubscriptionId) {
  if (!stripe || !stripeSubscriptionId) return null;
  try {
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ["default_payment_method"],
    });
    let raw = sub.default_payment_method;
    if (typeof raw === "string") {
      raw = await stripe.paymentMethods.retrieve(raw);
    }
    return summaryFromStripePaymentMethod(raw);
  } catch (e) {
    log.warn("project.subscription_details.payment_method_failed", {
      stripeSubscriptionId,
      error: e?.message ?? String(e),
    });
    return null;
  }
}

router.get("/subscriptions/details", async (req, res) => {
  const rows = await prisma.subscription.findMany({
    where: { userId: req.auth.userId },
    include: {
      plan: true,
      project: { select: { id: true, name: true, subscriptionStatus: true } },
      payments: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const paymentMethods = await Promise.all(rows.map((row) => fetchSubscriptionPaymentMethodSummary(row.stripeSubscriptionId)));
  return res.json(
    rows.map((row, i) => ({
      subscription: {
        id: row.id,
        userId: row.userId,
        projectId: row.projectId,
        planId: row.planId,
        status: row.status,
        billingCycle: row.billingCycle,
        currentPeriodStart: row.currentPeriodStart,
        currentPeriodEnd: row.currentPeriodEnd,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        pausedAt: row.pausedAt,
        canceledAt: row.canceledAt,
      },
      project: row.project,
      plan: row.plan
        ? {
            id: row.plan.id,
            code: row.plan.code,
            name: row.plan.name,
            currency: row.plan.currency,
            priceMonthlyCents: row.plan.priceMonthlyCents,
            priceYearlyCents: row.plan.priceYearlyCents,
          }
        : null,
      invoices: row.payments.map((p) => ({
        id: p.id,
        invoiceNumber: p.invoiceNumber,
        amountCents: p.amountCents,
        currency: p.currency,
        status: p.status,
        paidAt: p.paidAt,
        invoicePdfUrl: p.invoicePdfUrl,
      })),
      paymentMethod: paymentMethods[i],
    })),
  );
});

router.get("/:id", async (req, res) => {
  const row = await prisma.project.findFirst({
    where: { id: req.params.id, ownerUserId: req.auth.userId },
  });
  if (!row) return res.status(404).json({ error: "project_not_found" });
  const normalized = normalizeProject(row);
  if (normalized.subscriptionStatus !== row.subscriptionStatus) {
    await persistNormalizedStatus(row.id, normalized);
  }
  const sub = await findUserProjectSubscription(req.auth.userId, row.id, { include: { plan: true } });
  if (sub?.plan) {
    const j = sub.plan.catalogJson && typeof sub.plan.catalogJson === "object" ? sub.plan.catalogJson : {};
    const pagesRaw = j.pagesIncludedMax ?? j.pagesIncluded;
    const pagesMax =
      typeof pagesRaw === "number"
        ? pagesRaw
        : typeof pagesRaw === "string"
          ? parseInt(String(pagesRaw), 10)
          : null;
    const subCap = Math.max(0, sub.includedCreditsPerPeriod ?? 0);
    const planCap = Math.max(0, sub.plan?.includedEditCreditsPerPeriod ?? 0);
    const effectiveIncludedCap = subCap > 0 ? subCap : planCap;
    normalized.usage = {
      includedCreditsPerPeriod: effectiveIncludedCap,
      includedCreditsUsedThisPeriod: Math.max(0, sub.includedCreditsUsedThisPeriod ?? 0),
      purchasedCreditsBalance: Math.max(0, sub.purchasedCreditsBalance ?? 0),
      pagesIncludedMax: Number.isFinite(pagesMax) && pagesMax != null ? Math.max(0, pagesMax) : null,
      pagesUsed: null,
    };
  } else {
    normalized.usage = null;
  }

  const billingCycle = sub?.billingCycle ?? normalized.billingCycle ?? null;
  const addonCatalogRows = await fetchSubscriptionAddonCatalog();
  normalized.accessibleAddons = resolveProjectAccessibleAddons({
    catalog: addonCatalogRows,
    plan: sub?.plan ?? null,
    billingCycle,
    ownedAddonCodes: normalized.addons,
    periodStartIso: sub?.currentPeriodStart
      ? sub.currentPeriodStart instanceof Date
        ? sub.currentPeriodStart.toISOString()
        : String(sub.currentPeriodStart)
      : null,
  });
  normalized.extraEditPurchase = resolveExtraEditPurchaseSummary(
    addonCatalogRows,
    sub?.plan ?? null,
  );

  return res.json(normalized);
});

router.post("/", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  if (!name) return res.status(400).json({ error: "project_name_required" });
  const created = await prisma.project.create({
    data: {
      ownerUserId: req.auth.userId,
      name,
      description,
      subscriptionStatus: "not_started",
      addonsJson: [],
      invoicesJson: [],
    },
  });
  return res.status(201).json(normalizeProject(created));
});

router.post("/:id/addons/toggle", async (_req, res) => {
  return res.status(403).json({
    error: "addon_toggle_disabled",
    message: "Add-ons are purchased through checkout. Use the project dashboard to buy add-ons.",
  });
});

router.post("/:id/activate-subscription", async (req, res) => {
  const row = await prisma.project.findFirst({
    where: { id: req.params.id, ownerUserId: req.auth.userId },
  });
  if (!row) return res.status(404).json({ error: "project_not_found" });
  const requestedPlanId = String(req.body?.planId ?? "").trim();
  const requestedAmountCents = Number(req.body?.amountCents ?? 0);
  const requestedAddonsRaw = Array.isArray(req.body?.addons) ? req.body.addons : [];
  const addonCatalogRows = await fetchSubscriptionAddonCatalog();
  const addonCatalog = new Map(addonCatalogRows.map((row) => [row.code, row.priceCents]));
  const requestedAddonsFromBody = Array.from(
    new Set(
      requestedAddonsRaw
        .map((value) => String(value ?? "").trim())
        .filter((code) => addonCatalog.has(code)),
    ),
  );
  const currPre = normalizeProject(row);
  const requestedAddons = Array.from(
    new Set([...currPre.addons.filter((code) => addonCatalog.has(code)), ...requestedAddonsFromBody]),
  );
  if (!requestedPlanId || !Number.isFinite(requestedAmountCents) || requestedAmountCents < 0) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  /**
   * Resolve the right subscription row:
   *   1. The project-tagged Subscription (created by webhook with metadata.projectId).
   *   2. If none, pull from Stripe (projectId-aware) and try again.
   *   3. As a final fallback, take the user's primary live Subscription and re-tag it
   *      with this projectId (covers older flows where projectId metadata was missing).
   */
  async function resolveProjectSubscription() {
    let candidate = await findUserProjectSubscription(req.auth.userId, row.id, { include: { plan: true } });
    if (candidate) return candidate;
    try {
      await syncSubscriptionFromStripeForUserId(req.auth.userId, { projectId: row.id });
    } catch {
      /* best effort */
    }
    candidate = await findUserProjectSubscription(req.auth.userId, row.id, { include: { plan: true } });
    if (candidate) return candidate;
    const primary = await findPrimaryUserSubscription(req.auth.userId, { include: { plan: true } });
    if (!primary) return null;
    if (primary.projectId && primary.projectId !== row.id) {
      // Don't steal another project's subscription.
      return null;
    }
    if (primary.projectId !== row.id) {
      const reassigned = await prisma.subscription.update({
        where: { id: primary.id },
        data: { projectId: row.id },
        include: { plan: true },
      });
      return reassigned;
    }
    return primary;
  }

  const sub = await resolveProjectSubscription();
  if (!sub || !["active", "trialing"].includes(sub.status)) {
    return res.status(409).json({ error: "stripe_subscription_not_active" });
  }
  if (!sub.plan || sub.planId !== requestedPlanId) {
    return res.status(409).json({ error: "stripe_plan_mismatch" });
  }
  if (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() <= Date.now()) {
    return res.status(409).json({ error: "stripe_subscription_expired" });
  }
  const curr = currPre;
  const invoiceNumber = `PRJ-${(curr.name || "NEW").slice(0, 3).toUpperCase()}-${String(curr.invoices.length + 1).padStart(4, "0")}`;
  const basePlanAmount =
    sub.billingCycle === "yearly"
      ? sub.plan.priceYearlyCents
      : sub.plan.priceMonthlyCents;
  const addonsTotal = requestedAddons.reduce((sum, code) => sum + (addonCatalog.get(code) ?? 0), 0);
  const minimumExpected = basePlanAmount + addonsTotal;
  const finalAmountCents = Math.max(minimumExpected, Math.round(requestedAmountCents));
  const nextInvoices = [
    {
      id: `inv_${Math.random().toString(36).slice(2, 9)}`,
      invoiceNumber,
      amountCents: finalAmountCents,
      currency: sub.plan.currency || "USD",
      status: "succeeded",
      paidAt: new Date().toISOString(),
    },
    ...curr.invoices,
  ];
  const updated = await prisma.project.update({
    where: { id: row.id },
    data: {
      subscriptionStatus: "active",
      planId: sub.planId,
      planName: sub.plan.name,
      billingCycle: sub.billingCycle,
      planValidUntil: sub.currentPeriodEnd,
      addonsJson: requestedAddons,
      invoicesJson: nextInvoices,
    },
  });
  return res.json(normalizeProject(updated));
});

const adminProjectRouter = express.Router();
adminProjectRouter.use(requireAuth, requireRole("admin", "master_admin"));

adminProjectRouter.get("/users/:userId/projects", async (req, res) => {
  const rows = await prisma.project.findMany({
    where: { ownerUserId: req.params.userId },
    orderBy: { createdAt: "desc" },
  });
  return res.json(rows.map(normalizeProject));
});

adminProjectRouter.post("/users/:userId/projects", async (req, res) => {
  const userId = String(req.params.userId ?? "").trim();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "user_not_found" });
  const name = String(req.body?.name ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  if (!name) return res.status(400).json({ error: "project_name_required" });
  const created = await prisma.project.create({
    data: {
      ownerUserId: userId,
      name,
      description,
      subscriptionStatus: "not_started",
      addonsJson: [],
      invoicesJson: [],
    },
  });
  return res.status(201).json(normalizeProject(created));
});

export { router as projectRouter, adminProjectRouter };
