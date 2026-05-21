import { prisma } from "../db/client.mjs";
import { readAddonEffectKind, didBillingPeriodAdvance } from "./subscriptionCredits.mjs";
import { isCreditPackAddon } from "./projectAccessibleAddons.mjs";
import { isRushEditSurchargeAddon } from "./rushEditSurcharge.mjs";

/** Plan catalog flags → add-on codes included with the subscription (not in addonsJson). */
export const PLAN_BUNDLED_ADDON_LINKS = [
  { flag: "monthlySeoReport", code: "addon_monthly_seo_report", recurringType: "monthly" },
  { flag: "liveChatIncluded", code: "addon_live_chat_starter", recurringType: "monthly" },
  { flag: "bookingIncluded", code: "addon_booking_widget", recurringType: "monthly" },
  { flag: "blogCmsAccess", code: "addon_blog_cms_starter", recurringType: "monthly" },
  { flag: "socialFeedEmbed", code: "addon_social_feed_embed", recurringType: "monthly" },
  { flag: "fullSeoSetupOneTime", code: "addon_full_seo_setup", recurringType: "one_time" },
  { flag: "googleBusinessProfileOneTime", code: "addon_google_business_profile", recurringType: "one_time" },
];

const OPEN_TICKET_STATUSES = ["open", "in_progress", "hold"];

export function isAddonEligibleForSupportTickets(addonRow) {
  if (!addonRow?.code || addonRow.isActive === false) return false;
  if (isCreditPackAddon(addonRow)) return false;
  if (isRushEditSurchargeAddon(addonRow)) return false;
  const effect = readAddonEffectKind(addonRow.catalogJson);
  if (effect === "credit_pack" || effect === "priority_boost" || effect === "per_ticket") return false;
  if (effect === "consumable_service") return true;
  if (addonRow.billingKind === "one_time" || addonRow.billingKind === "per_use") return true;
  if (addonRow.billingKind === "recurring") return true;
  return false;
}

export function resolveAddonRecurringProfile(addonRow) {
  const setup = Math.max(0, addonRow.setupFeeCents ?? 0);
  const hasSetupFee = setup > 0;
  if (addonRow.billingKind === "one_time" || addonRow.billingKind === "per_use") {
    return { isRecurring: false, recurringType: "one_time", hasSetupFee };
  }
  if (addonRow.billingMonthlyEnabled === false && addonRow.billingYearlyEnabled === false) {
    return { isRecurring: false, recurringType: "one_time", hasSetupFee };
  }
  return { isRecurring: true, recurringType: "monthly", hasSetupFee };
}

/**
 * Effective billing cadence for utilization cycles (monthly vs yearly).
 * Separate Stripe add-on subscriptions override plan-attached cadence.
 */
export async function resolveEffectiveAddonBillingCycle(addonCode, projectId, subscriptionBillingCycle) {
  const row = await prisma.projectRecurringAddonStripe.findUnique({
    where: { projectId_addonCode: { projectId, addonCode } },
    select: { billingCycle: true },
  });
  if (row?.billingCycle) return row.billingCycle;

  const subCycle = subscriptionBillingCycle === "yearly" ? "yearly" : "monthly";
  if (subCycle === "monthly") return "monthly";

  const addon = await prisma.subscriptionAddon.findUnique({
    where: { code: addonCode },
    select: { billingMonthlyEnabled: true, billingYearlyEnabled: true },
  });
  if (!addon) return "monthly";
  if (addon.billingMonthlyEnabled !== false) return "monthly";
  if (addon.billingYearlyEnabled !== false) return "yearly";
  return "monthly";
}

/** Current utilization window for an add-on on a project subscription. */
export function resolveUtilizationCycleBounds({
  recurringType,
  addonBillingCycle,
  subscriptionPeriodStart,
  subscriptionPeriodEnd,
  now = new Date(),
}) {
  const periodStart = new Date(subscriptionPeriodStart);
  const periodEnd = new Date(subscriptionPeriodEnd);

  if (recurringType === "one_time") {
    return { cycleStart: periodStart, cycleEnd: periodEnd };
  }

  const useYearlyCycle =
    recurringType === "yearly" ||
    addonBillingCycle === "yearly" ||
    (addonBillingCycle !== "monthly" && recurringType !== "monthly");

  if (useYearlyCycle) {
    return { cycleStart: periodStart, cycleEnd: periodEnd };
  }

  const t = now.getTime();
  let cursor = new Date(periodStart);
  while (cursor.getTime() < periodEnd.getTime()) {
    const next = new Date(cursor);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const segmentEnd = next.getTime() < periodEnd.getTime() ? next : periodEnd;
    if (t >= cursor.getTime() && t < segmentEnd.getTime()) {
      return { cycleStart: new Date(cursor), cycleEnd: segmentEnd };
    }
    cursor = next;
  }
  return { cycleStart: periodStart, cycleEnd: periodEnd };
}

export function bundledAddonCodesForPlan(plan) {
  const catalog = plan?.catalogJson && typeof plan.catalogJson === "object" ? plan.catalogJson : {};
  const codes = [];
  for (const link of PLAN_BUNDLED_ADDON_LINKS) {
    if (catalog[link.flag] === true) codes.push({ code: link.code, recurringType: link.recurringType });
  }
  return codes;
}

export async function listOwnedTicketEligibleAddonCodes(project, plan) {
  const owned = new Set(
    Array.isArray(project.addonsJson)
      ? project.addonsJson.filter((c) => typeof c === "string" && c.trim())
      : [],
  );
  for (const { code } of bundledAddonCodesForPlan(plan)) {
    owned.add(code);
  }
  return [...owned];
}

function appendHistory(existing, entry) {
  const prev = Array.isArray(existing) ? existing : [];
  return [...prev, entry].slice(-50);
}

export async function findTrackingRowForCycle(tx, keys) {
  return tx.addonUtilizationTracking.findUnique({
    where: {
      userId_projectId_subscriptionAddonId_currentCycleStart: {
        userId: keys.userId,
        projectId: keys.projectId,
        subscriptionAddonId: keys.subscriptionAddonId,
        currentCycleStart: keys.currentCycleStart,
      },
    },
  });
}

export async function getOrCreateTrackingRow(tx, ctx) {
  const {
    userId,
    projectId,
    subscriptionId,
    subscriptionAddonId,
    addonRow,
    subscription,
    isBundled = false,
    now = new Date(),
  } = ctx;

  const profile = resolveAddonRecurringProfile(addonRow);
  const addonBillingCycle = await resolveEffectiveAddonBillingCycle(
    addonRow.code,
    projectId,
    subscription.billingCycle,
  );
  const recurringType =
    profile.recurringType === "one_time"
      ? "one_time"
      : addonBillingCycle === "yearly"
        ? "yearly"
        : "monthly";

  const { cycleStart, cycleEnd } = resolveUtilizationCycleBounds({
    recurringType,
    addonBillingCycle,
    subscriptionPeriodStart: subscription.currentPeriodStart,
    subscriptionPeriodEnd: subscription.currentPeriodEnd,
    now,
  });

  const keys = {
    userId,
    projectId,
    subscriptionAddonId,
    currentCycleStart: cycleStart,
  };

  let row = await findTrackingRowForCycle(tx, keys);
  if (row) return row;

  row = await tx.addonUtilizationTracking.create({
    data: {
      userId,
      projectId,
      subscriptionId,
      subscriptionAddonId,
      isRecurring: profile.isRecurring,
      recurringType,
      hasSetupFee: profile.hasSetupFee,
      isBundled,
      currentCycleStart: cycleStart,
      currentCycleEnd: cycleEnd,
      isUtilized: false,
      utilizationHistory: [],
    },
  });
  return row;
}

export async function hasOpenAddonTicket(tx, { userId, projectId, subscriptionAddonId }) {
  const open = await tx.supportTicket.findFirst({
    where: {
      userId,
      projectId,
      subscriptionAddonId,
      category: "addon",
      status: { in: OPEN_TICKET_STATUSES },
    },
    select: { id: true },
  });
  return Boolean(open);
}

export async function isAddonPaymentEligible({ subscription, addonCode, addonLabel }) {
  if (!subscription || !["active", "trialing"].includes(subscription.status)) {
    return { ok: false, reason: "subscription_inactive" };
  }

  const separate = await prisma.projectRecurringAddonStripe.findUnique({
    where: {
      projectId_addonCode: { projectId: subscription.projectId, addonCode },
    },
  });

  if (!separate) {
    if (subscription.status === "past_due") {
      return { ok: false, reason: "subscription_payment_pending" };
    }
    return { ok: true };
  }

  const needle = `${addonLabel ?? addonCode} (add-on)`;
  const latest = await prisma.payment.findFirst({
    where: {
      subscriptionId: subscription.id,
      invoiceNumber: { contains: needle },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return { ok: true };
  if (latest.status === "failed") {
    return { ok: false, reason: "addon_payment_failed" };
  }
  return { ok: true };
}

/**
 * Validate whether the user may open an add-on support ticket for the current cycle.
 */
export async function validateAddonTicketCreation({
  userId,
  projectId,
  subscriptionAddonId,
  addonRow,
  subscription,
  project,
  plan,
}) {
  if (!subscription || !["active", "trialing"].includes(subscription.status)) {
    return { ok: false, error: "subscription_inactive", message: "An active subscription is required for add-on requests." };
  }

  const ownedCodes = await listOwnedTicketEligibleAddonCodes(project, plan);
  if (!ownedCodes.includes(addonRow.code)) {
    return { ok: false, error: "addon_not_owned", message: "This add-on is not active on the selected project." };
  }

  const payment = await isAddonPaymentEligible({
    subscription,
    addonCode: addonRow.code,
    addonLabel: addonRow.label,
  });
  if (!payment.ok) {
    const msg =
      payment.reason === "addon_payment_failed"
        ? "The latest recurring payment for this add-on failed. Update billing before opening a new request."
        : "Subscription payment is pending. Resolve billing before opening an add-on request.";
    return { ok: false, error: payment.reason, message: msg };
  }

  const bundled = bundledAddonCodesForPlan(plan).some((b) => b.code === addonRow.code);
  const tracking = await prisma.$transaction((tx) =>
    getOrCreateTrackingRow(tx, {
      userId,
      projectId,
      subscriptionId: subscription.id,
      subscriptionAddonId,
      addonRow,
      subscription,
      isBundled: bundled,
    }),
  );

  if (tracking.isUtilized) {
    const profile = resolveAddonRecurringProfile(addonRow);
    const msg = profile.isRecurring
      ? "This add-on has already been used for the current billing cycle. It will be available again after your next successful renewal."
      : "This one-time add-on has already been used for this project.";
    return { ok: false, error: "addon_already_utilized", message: msg, tracking };
  }

  if (tracking.activeSupportTicketId) {
    return {
      ok: false,
      error: "addon_ticket_already_open",
      message: "You already have an open support request for this add-on in the current cycle.",
      tracking,
    };
  }

  const duplicateOpen = await hasOpenAddonTicket(prisma, {
    userId,
    projectId,
    subscriptionAddonId,
  });
  if (duplicateOpen) {
    return {
      ok: false,
      error: "addon_ticket_already_open",
      message: "You already have an open support request for this add-on.",
      tracking,
    };
  }

  return { ok: true, tracking };
}

export async function linkAddonTicketToTrackingTx(tx, { trackingId, ticketId }) {
  await tx.addonUtilizationTracking.update({
    where: { id: trackingId },
    data: { activeSupportTicketId: ticketId },
  });
}

export async function markAddonUtilizedOnTicketResolvedTx(tx, ticket, { workCompleted = true } = {}) {
  if (ticket.category !== "addon" || !ticket.subscriptionAddonId || !ticket.projectId) {
    return { applied: false };
  }
  if (!workCompleted) {
    await tx.addonUtilizationTracking.updateMany({
      where: { activeSupportTicketId: ticket.id },
      data: { activeSupportTicketId: null },
    });
    return { applied: false, refunded: true };
  }

  const now = new Date();
  const rows = await tx.addonUtilizationTracking.findMany({
    where: { activeSupportTicketId: ticket.id },
  });

  for (const row of rows) {
    await tx.addonUtilizationTracking.update({
      where: { id: row.id },
      data: {
        isUtilized: true,
        lastUtilizedAt: now,
        activeSupportTicketId: null,
        utilizationHistory: appendHistory(row.utilizationHistory, {
          event: "utilized",
          at: now.toISOString(),
          supportTicketId: ticket.id,
        }),
      },
    });
  }

  if (rows.length === 0) {
    const addon = await tx.subscriptionAddon.findUnique({
      where: { id: ticket.subscriptionAddonId },
    });
    const sub = await tx.subscription.findFirst({
      where: { userId: ticket.userId, projectId: ticket.projectId },
    });
    if (addon && sub) {
      const tracking = await getOrCreateTrackingRow(tx, {
        userId: ticket.userId,
        projectId: ticket.projectId,
        subscriptionId: sub.id,
        subscriptionAddonId: ticket.subscriptionAddonId,
        addonRow: addon,
        subscription: sub,
      });
      await tx.addonUtilizationTracking.update({
        where: { id: tracking.id },
        data: {
          isUtilized: true,
          lastUtilizedAt: now,
          activeSupportTicketId: null,
          utilizationHistory: appendHistory(tracking.utilizationHistory, {
            event: "utilized",
            at: now.toISOString(),
            supportTicketId: ticket.id,
          }),
        },
      });
    }
  }

  const profile = await tx.subscriptionAddon.findUnique({
    where: { id: ticket.subscriptionAddonId },
    select: { billingKind: true, catalogJson: true },
  });
  if (
    profile?.billingKind === "one_time" &&
    readAddonEffectKind(profile.catalogJson) === "consumable_service"
  ) {
    await tx.projectAddonEntitlement.updateMany({
      where: {
        projectId: ticket.projectId,
        subscriptionAddonId: ticket.subscriptionAddonId,
        consumedAt: null,
      },
      data: { consumedAt: now },
    });
  }

  return { applied: true };
}

async function resetTrackingRowsForAddons(tx, { subscription, addonCodes, reason, isBundledFilter = null }) {
  if (!addonCodes?.length) return 0;
  const addons = await tx.subscriptionAddon.findMany({
    where: { code: { in: addonCodes }, isActive: true },
    select: { id: true, code: true },
  });
  if (!addons.length) return 0;

  let resetCount = 0;
  const now = new Date();

  for (const addon of addons) {
    const addonRow = await tx.subscriptionAddon.findUnique({ where: { id: addon.id } });
    if (!addonRow || !isAddonEligibleForSupportTickets(addonRow)) continue;

    const profile = resolveAddonRecurringProfile(addonRow);
    if (!profile.isRecurring) continue;

    const addonBillingCycle = await resolveEffectiveAddonBillingCycle(
      addon.code,
      subscription.projectId,
      subscription.billingCycle,
    );
    const recurringType = addonBillingCycle === "yearly" ? "yearly" : "monthly";
    const { cycleStart, cycleEnd } = resolveUtilizationCycleBounds({
      recurringType,
      addonBillingCycle,
      subscriptionPeriodStart: subscription.currentPeriodStart,
      subscriptionPeriodEnd: subscription.currentPeriodEnd,
      now,
    });

    const existing = await findTrackingRowForCycle(tx, {
      userId: subscription.userId,
      projectId: subscription.projectId,
      subscriptionAddonId: addon.id,
      currentCycleStart: cycleStart,
    });

    if (existing) {
      if (isBundledFilter === true && !existing.isBundled) continue;
      if (isBundledFilter === false && existing.isBundled) continue;
      if (!existing.isUtilized && !existing.activeSupportTicketId) continue;
      await tx.addonUtilizationTracking.update({
        where: { id: existing.id },
        data: {
          isUtilized: false,
          lastUtilizedAt: null,
          activeSupportTicketId: null,
          currentCycleEnd: cycleEnd,
          utilizationHistory: appendHistory(existing.utilizationHistory, {
            event: "cycle_reset",
            at: now.toISOString(),
            reason,
          }),
        },
      });
      resetCount += 1;
      continue;
    }

    await getOrCreateTrackingRow(tx, {
      userId: subscription.userId,
      projectId: subscription.projectId,
      subscriptionId: subscription.id,
      subscriptionAddonId: addon.id,
      addonRow,
      subscription,
      isBundled: isBundledFilter === true,
    });
    resetCount += 1;
  }

  return resetCount;
}

/** Reset recurring add-ons tied to the plan subscription period (same Stripe sub). */
export async function resetAddonUtilizationOnSubscriptionRenewalTx(tx, subscription, { reason = "subscription_renewal" } = {}) {
  const project = await tx.project.findUnique({
    where: { id: subscription.projectId },
    select: { addonsJson: true },
  });
  if (!project) return 0;

  const plan = await tx.plan.findUnique({ where: { id: subscription.planId } });
  const codes = await listOwnedTicketEligibleAddonCodes(project, plan);

  const separateRows = await tx.projectRecurringAddonStripe.findMany({
    where: { projectId: subscription.projectId },
    select: { addonCode: true },
  });
  const separateSet = new Set(separateRows.map((r) => r.addonCode));
  const planAttached = codes.filter((c) => !separateSet.has(c));

  let total = await resetTrackingRowsForAddons(tx, {
    subscription,
    addonCodes: planAttached,
    reason,
    isBundledFilter: null,
  });

  if (subscription.billingCycle === "yearly" && plan) {
    const bundledMonthly = bundledAddonCodesForPlan(plan)
      .filter((b) => b.recurringType === "monthly")
      .map((b) => b.code);
    total += await resetTrackingRowsForAddons(tx, {
      subscription,
      addonCodes: bundledMonthly,
      reason: "yearly_plan_monthly_bundled_reset",
      isBundledFilter: true,
    });
  }

  return total;
}

/** Reset a single add-on after its dedicated Stripe subscription invoice is paid. */
export async function resetAddonUtilizationOnAddonRenewalTx(tx, { subscription, addonCode, reason = "addon_renewal" }) {
  return resetTrackingRowsForAddons(tx, {
    subscription,
    addonCodes: [addonCode],
    reason,
  });
}

export async function maybeResetAddonUtilizationAfterSubscriptionPatch(existing, patch) {
  const nextStart = patch.currentPeriodStart;
  if (!didBillingPeriodAdvance(existing.currentPeriodStart, nextStart)) return 0;

  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({
      where: { id: existing.id },
      include: { plan: true },
    });
    if (!sub) return 0;
    return resetAddonUtilizationOnSubscriptionRenewalTx(tx, sub);
  });
}

export async function buildAddonTicketOptionsForProject({ userId, projectId }) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: userId },
  });
  if (!project) return null;

  const subscription = await prisma.subscription.findFirst({
    where: { userId, projectId },
    include: { plan: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!subscription || !["active", "trialing"].includes(subscription.status)) {
    return { addons: [], subscriptionActive: false };
  }

  const ownedCodes = await listOwnedTicketEligibleAddonCodes(project, subscription.plan);
  const catalog = await prisma.subscriptionAddon.findMany({
    where: { code: { in: ownedCodes }, isActive: true },
  });

  const options = [];
  for (const row of catalog) {
    if (!isAddonEligibleForSupportTickets(row)) continue;

    const validation = await validateAddonTicketCreation({
      userId,
      projectId,
      subscriptionAddonId: row.id,
      addonRow: row,
      subscription,
      project,
      plan: subscription.plan,
    });

    const profile = resolveAddonRecurringProfile(row);
    const addonBillingCycle = await resolveEffectiveAddonBillingCycle(
      row.code,
      projectId,
      subscription.billingCycle,
    );
    const tracking = validation.tracking ?? null;

    options.push({
      id: row.id,
      code: row.code,
      label: row.label,
      desc: row.desc ?? "",
      billingKind: row.billingKind,
      recurringType: tracking?.recurringType ?? profile.recurringType,
      addonBillingCycle,
      subscriptionBillingCycle: subscription.billingCycle,
      hasSetupFee: profile.hasSetupFee,
      eligible: validation.ok,
      ineligibleReason: validation.ok ? null : validation.error,
      ineligibleMessage: validation.ok ? null : validation.message,
      isUtilized: tracking?.isUtilized ?? false,
      currentCycleStart: tracking?.currentCycleStart?.toISOString() ?? null,
      currentCycleEnd: tracking?.currentCycleEnd?.toISOString() ?? null,
      isBundled: tracking?.isBundled ?? bundledAddonCodesForPlan(subscription.plan).some((b) => b.code === row.code),
    });
  }

  options.sort((a, b) => a.label.localeCompare(b.label));
  return { addons: options, subscriptionActive: true };
}

export function userMessageForAddonTicketError(code) {
  const map = {
    addon_not_owned: "This add-on is not on the selected project.",
    addon_already_utilized: "This add-on is not available for a new request in the current billing cycle.",
    addon_ticket_already_open: "You already have an open request for this add-on.",
    subscription_inactive: "An active subscription is required for add-on requests.",
    subscription_payment_pending: "Resolve subscription billing before opening an add-on request.",
    addon_payment_failed: "The latest add-on payment failed. Update billing first.",
    addon_required: "Select an add-on for this request.",
    project_required_for_addon: "Select a project for add-on requests.",
  };
  return map[code] ?? "Cannot create this add-on request.";
}

/**
 * Dashboard fulfillment state for ticket-gated add-ons (manual / consumable_service delivery).
 */
export function computeAddonFulfillmentStatus({ tracking, openTicket }) {
  if (tracking?.isUtilized) {
    return {
      status: "setup_completed",
      tracksFulfillment: true,
      activeTicketId: null,
      activeTicketSubject: null,
    };
  }

  const ticket =
    openTicket && OPEN_TICKET_STATUSES.includes(String(openTicket.status ?? "").toLowerCase())
      ? openTicket
      : null;

  if (ticket) {
    return {
      status: "in_progress",
      tracksFulfillment: true,
      activeTicketId: ticket.id,
      activeTicketSubject: ticket.subject ?? null,
    };
  }

  return {
    status: "not_used",
    tracksFulfillment: true,
    activeTicketId: null,
    activeTicketSubject: null,
  };
}

export async function resolveFulfillmentForOwnedAddon({
  userId,
  projectId,
  subscription,
  project,
  plan,
  addonRow,
}) {
  if (!subscription || !["active", "trialing"].includes(subscription.status)) {
    return null;
  }
  if (!isAddonEligibleForSupportTickets(addonRow)) {
    return null;
  }

  const bundled = bundledAddonCodesForPlan(plan).some((b) => b.code === addonRow.code);
  const tracking = await prisma.$transaction((tx) =>
    getOrCreateTrackingRow(tx, {
      userId,
      projectId,
      subscriptionId: subscription.id,
      subscriptionAddonId: addonRow.id,
      addonRow,
      subscription,
      isBundled: bundled,
    }),
  );

  let openTicket = null;
  if (tracking.activeSupportTicketId) {
    openTicket = await prisma.supportTicket.findFirst({
      where: { id: tracking.activeSupportTicketId, userId, projectId },
      select: { id: true, status: true, subject: true },
    });
  }
  if (!openTicket || !OPEN_TICKET_STATUSES.includes(String(openTicket.status ?? "").toLowerCase())) {
    openTicket = await prisma.supportTicket.findFirst({
      where: {
        userId,
        projectId,
        subscriptionAddonId: addonRow.id,
        category: "addon",
        status: { in: OPEN_TICKET_STATUSES },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, status: true, subject: true },
    });
  }

  return computeAddonFulfillmentStatus({ tracking, openTicket });
}

/** Attach fulfillment status to each owned add-on card on GET /api/projects/:id. */
export async function enrichProjectAccessibleAddonsWithFulfillment({
  accessibleAddons,
  catalog,
  userId,
  projectId,
  subscription,
  project,
  plan,
}) {
  if (!accessibleAddons?.existing?.length) return accessibleAddons;

  const codeToRow = new Map(catalog.map((row) => [row.code, row]));
  const existing = [];

  for (const card of accessibleAddons.existing) {
    const addonRow = codeToRow.get(card.code);
    if (!addonRow) {
      existing.push(card);
      continue;
    }
    const fulfillment = await resolveFulfillmentForOwnedAddon({
      userId,
      projectId,
      subscription,
      project,
      plan,
      addonRow,
    });
    existing.push(fulfillment ? { ...card, fulfillment } : card);
  }

  return { ...accessibleAddons, existing };
}
