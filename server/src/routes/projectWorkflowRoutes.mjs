import express from "express";
import { prisma } from "../db/client.mjs";
import { env } from "../config/env.mjs";
import { requireAuth, requireRole } from "../middleware/auth.mjs";
import { validate } from "../middleware/validate.mjs";
import { sendTransactionalEmail } from "../services/emailService.mjs";
import { escapeHtml } from "../utils/htmlEscape.mjs";
import { logAuditEvent, requestAuditContext } from "../services/auditLogService.mjs";
import {
  applyChatActivity,
  deriveNextAction,
  updateWorkflowStatus,
  workflowSnapshot,
} from "../services/projectWorkflowService.mjs";
import { issueShareLink, revokeShareLink } from "../services/projectShareService.mjs";
import {
  chatMarkReadSchema,
  projectApprovalSchema,
  projectChatPostSchema,
  projectPendingCheckoutSchema,
  projectSettingsPatchSchema,
  projectShareLinkSchema,
  projectUrlsPatchSchema,
  updateWorkflowSchema,
} from "../schemas/projectWorkflowSchemas.mjs";
import { log } from "../observability/logger.mjs";

const router = express.Router();
router.use(requireAuth);

const STAFF_ROLES = new Set(["admin", "master_admin", "support"]);

/** Authorize: owner OR staff (admin/master_admin/support). Returns the project row or sends 404. */
async function loadAccessibleProject(req, res, { staffOnly = false } = {}) {
  const { id } = req.params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { assignedDesigner: true, owner: true },
  });
  if (!project) {
    res.status(404).json({ error: "project_not_found" });
    return null;
  }
  const isOwner = project.ownerUserId === req.auth.userId;
  const isStaff = STAFF_ROLES.has(req.auth.role);
  if (staffOnly && !isStaff) {
    res.status(403).json({ error: "forbidden" });
    return null;
  }
  if (!isOwner && !isStaff) {
    res.status(404).json({ error: "project_not_found" });
    return null;
  }
  return { project, isOwner, isStaff };
}

/* ──────────────────── Workflow snapshot ──────────────────── */

router.get("/:id/workflow", async (req, res) => {
  const ctx = await loadAccessibleProject(req, res);
  if (!ctx) return;
  const snap = workflowSnapshot(ctx.project, ctx.project.assignedDesigner);
  const [unreadCount, recentChat] = await Promise.all([
    prisma.projectChatMessage.count({
      where: {
        projectId: ctx.project.id,
        isStaff: true,
        readByCustomerAt: null,
      },
    }),
    prisma.projectChatMessage.findFirst({
      where: { projectId: ctx.project.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, isStaff: true, createdAt: true },
    }),
  ]);
  const nextAction = deriveNextAction(ctx.project, {
    hasUnreadDesignerMessage: ctx.isOwner ? unreadCount > 0 : false,
    hasUploadedAssets: false,
  });
  res.json({
    ...snap,
    customerUnreadCount: unreadCount,
    lastChatAt: recentChat?.createdAt?.toISOString?.() ?? null,
    nextAction,
  });
});

/* ──────────────────── Workflow update (staff only) ──────────────────── */

router.patch("/:id/workflow", validate(updateWorkflowSchema), async (req, res) => {
  const ctx = await loadAccessibleProject(req, res, { staffOnly: true });
  if (!ctx) return;
  const auditCtx = requestAuditContext(req);
  const body = req.validatedBody;
  if (body.phaseProgressPercent !== undefined) {
    await prisma.project.update({
      where: { id: ctx.project.id },
      data: {
        phaseProgressPercent: body.phaseProgressPercent,
        lastDesignerActivityAt: new Date(),
        designerHeartbeatAt: new Date(),
      },
    });
  }
  if (body.workflowStatus) {
    await updateWorkflowStatus({
      projectId: ctx.project.id,
      toStatus: body.workflowStatus,
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      reason: body.reason,
      auditCtx,
    });
  }
  const updated = await prisma.project.findUnique({
    where: { id: ctx.project.id },
    include: { assignedDesigner: true },
  });
  res.json(workflowSnapshot(updated, updated.assignedDesigner));
});

/* ──────────────────── Per-project chat ──────────────────── */

router.get("/:id/chat", async (req, res) => {
  const ctx = await loadAccessibleProject(req, res);
  if (!ctx) return;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const rows = await prisma.projectChatMessage.findMany({
    where: { projectId: ctx.project.id },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { author: { select: { id: true, name: true, role: true } } },
  });
  res.json({
    items: rows.map((m) => ({
      id: m.id,
      body: m.body,
      isStaff: m.isStaff,
      authorId: m.authorUserId,
      authorName: m.author?.name ?? null,
      authorRole: m.author?.role ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

router.post("/:id/chat", validate(projectChatPostSchema), async (req, res) => {
  const ctx = await loadAccessibleProject(req, res);
  if (!ctx) return;
  const isStaff = ctx.isStaff;
  const { body, markWaitingForCustomerReply } = req.validatedBody;
  const msg = await prisma.projectChatMessage.create({
    data: {
      projectId: ctx.project.id,
      authorUserId: req.auth.userId,
      isStaff,
      body,
    },
  });
  const auditCtx = requestAuditContext(req);
  await applyChatActivity({
    project: ctx.project,
    isStaff,
    markWaiting: Boolean(markWaitingForCustomerReply),
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    auditCtx,
  });
  await logAuditEvent({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    action: "project.chat_message_sent",
    targetType: "project",
    targetId: ctx.project.id,
    metadata: { isStaff, messageId: msg.id, length: body.length },
    ...auditCtx,
  });

  // Notify the other side if their preference allows.
  try {
    if (isStaff && ctx.project.notifyOnDesignerReply && ctx.project.owner?.email) {
      await sendTransactionalEmail({
        to: ctx.project.owner.email,
        template: "project_chat_reply",
        idempotencyKey: `proj_chat_${msg.id}`,
        subject: `New message on "${ctx.project.name}"`,
        html: `<p>Hi ${escapeHtml(ctx.project.owner.name)},</p><p>Your designer sent a new message on <strong>${escapeHtml(ctx.project.name)}</strong>:</p><blockquote>${escapeHtml(body)}</blockquote><p><a href="${env.appUrl}/projects/${ctx.project.id}#project-chat">Open chat</a></p>`,
      });
    }
  } catch (e) {
    log.warnReq(req, "project.chat_notification_failed", { error: e?.message });
  }

  res.status(201).json({
    id: msg.id,
    createdAt: msg.createdAt.toISOString(),
    isStaff,
  });
});

router.post("/:id/chat/mark-read", validate(chatMarkReadSchema), async (req, res) => {
  const ctx = await loadAccessibleProject(req, res);
  if (!ctx) return;
  const now = new Date();
  const where = { projectId: ctx.project.id };
  if (ctx.isStaff) {
    await prisma.projectChatMessage.updateMany({
      where: { ...where, isStaff: false, readByStaffAt: null },
      data: { readByStaffAt: now },
    });
  } else {
    await prisma.projectChatMessage.updateMany({
      where: { ...where, isStaff: true, readByCustomerAt: null },
      data: { readByCustomerAt: now },
    });
  }
  res.json({ ok: true });
});

/* ──────────────────── Per-project settings ──────────────────── */

router.patch("/:id/settings", validate(projectSettingsPatchSchema), async (req, res) => {
  const ctx = await loadAccessibleProject(req, res);
  if (!ctx) return;
  // Owner manages brand voice + their own notification prefs.
  if (!ctx.isOwner && !ctx.isStaff) {
    return res.status(403).json({ error: "forbidden" });
  }
  const updated = await prisma.project.update({
    where: { id: ctx.project.id },
    data: req.validatedBody,
    include: { assignedDesigner: true },
  });
  await logAuditEvent({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    action: "project.settings_updated",
    targetType: "project",
    targetId: ctx.project.id,
    metadata: { fields: Object.keys(req.validatedBody) },
    ...requestAuditContext(req),
  });
  res.json(workflowSnapshot(updated, updated.assignedDesigner));
});

/* ──────────────────── Staging / live URL (staff sets) ──────────────────── */

router.patch("/:id/urls", validate(projectUrlsPatchSchema), async (req, res) => {
  const ctx = await loadAccessibleProject(req, res, { staffOnly: true });
  if (!ctx) return;
  const data = {};
  if (req.validatedBody.stagingUrl !== undefined) {
    data.stagingUrl = req.validatedBody.stagingUrl || null;
  }
  if (req.validatedBody.liveUrl !== undefined) {
    data.liveUrl = req.validatedBody.liveUrl || null;
  }
  data.lastDesignerActivityAt = new Date();
  data.designerHeartbeatAt = new Date();
  const updated = await prisma.project.update({
    where: { id: ctx.project.id },
    data,
    include: { assignedDesigner: true },
  });
  await logAuditEvent({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    action: "project.urls_updated",
    targetType: "project",
    targetId: ctx.project.id,
    metadata: { ...data, lastDesignerActivityAt: undefined, designerHeartbeatAt: undefined },
    ...requestAuditContext(req),
  });
  res.json(workflowSnapshot(updated, updated.assignedDesigner));
});

/* ──────────────────── Approval checkpoints (customer-only) ──────────────────── */

router.post("/:id/approve", validate(projectApprovalSchema), async (req, res) => {
  const ctx = await loadAccessibleProject(req, res);
  if (!ctx) return;
  if (!ctx.isOwner) return res.status(403).json({ error: "owner_only" });
  const { kind, note } = req.validatedBody;
  const auditCtx = requestAuditContext(req);
  const now = new Date();
  if (kind === "design") {
    await prisma.project.update({
      where: { id: ctx.project.id },
      data: { approvedDesignAt: now, lastCustomerActivityAt: now },
    });
    await updateWorkflowStatus({
      projectId: ctx.project.id,
      toStatus: "approved",
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      reason: "customer_approved_design",
      auditCtx,
    });
  } else {
    if (!ctx.project.approvedDesignAt) {
      return res.status(409).json({ error: "approve_design_first", message: "Approve the design before approving launch." });
    }
    await prisma.project.update({
      where: { id: ctx.project.id },
      data: { approvedLaunchAt: now, lastCustomerActivityAt: now },
    });
    await updateWorkflowStatus({
      projectId: ctx.project.id,
      toStatus: "live",
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      reason: "customer_approved_launch",
      auditCtx,
    });
  }
  await logAuditEvent({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    action: `project.approved_${kind}`,
    targetType: "project",
    targetId: ctx.project.id,
    metadata: { note: note ?? null },
    ...auditCtx,
  });
  const updated = await prisma.project.findUnique({
    where: { id: ctx.project.id },
    include: { assignedDesigner: true },
  });
  res.json(workflowSnapshot(updated, updated.assignedDesigner));
});

/* ──────────────────── Project-scoped finance (invoices + payments via subscription) ──────────────────── */

router.get("/:id/finance", async (req, res) => {
  const ctx = await loadAccessibleProject(req, res);
  if (!ctx) return;
  const sub = await prisma.subscription.findFirst({
    where: { projectId: ctx.project.id },
    include: {
      plan: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  res.json({
    project: { id: ctx.project.id, name: ctx.project.name },
    subscription: sub
      ? {
          id: sub.id,
          status: sub.status,
          billingCycle: sub.billingCycle,
          currentPeriodStart: sub.currentPeriodStart?.toISOString?.() ?? null,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString?.() ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          pausedAt: sub.pausedAt?.toISOString?.() ?? null,
          canceledAt: sub.canceledAt?.toISOString?.() ?? null,
          includedCreditsPerPeriod: sub.includedCreditsPerPeriod,
          includedCreditsUsedThisPeriod: sub.includedCreditsUsedThisPeriod,
          purchasedCreditsBalance: sub.purchasedCreditsBalance,
        }
      : null,
    plan: sub?.plan
      ? {
          id: sub.plan.id,
          code: sub.plan.code,
          name: sub.plan.name,
          currency: sub.plan.currency,
          priceMonthlyCents: sub.plan.priceMonthlyCents,
          priceYearlyCents: sub.plan.priceYearlyCents,
        }
      : null,
    invoices: (sub?.payments ?? []).map((p) => ({
      id: p.id,
      invoiceNumber: p.invoiceNumber,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      paidAt: p.paidAt?.toISOString?.() ?? null,
      invoicePdfUrl: p.invoicePdfUrl,
    })),
  });
});

/* ──────────────────── Project-scoped activity (audit log slice) ──────────────────── */

router.get("/:id/activity", async (req, res) => {
  const ctx = await loadAccessibleProject(req, res);
  if (!ctx) return;
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
  const rows = await prisma.auditLog.findMany({
    where: { targetType: "project", targetId: ctx.project.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json({
    items: rows.map((a) => ({
      id: a.id,
      action: a.action,
      actorRole: a.actorRole,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

/* ──────────────────── Project tickets (filtered slice) ──────────────────── */

router.get("/:id/tickets", async (req, res) => {
  const ctx = await loadAccessibleProject(req, res);
  if (!ctx) return;
  const rows = await prisma.supportTicket.findMany({
    where: { projectId: ctx.project.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      subject: true,
      status: true,
      priority: true,
      category: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  res.json({
    items: rows.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      category: t.category,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
});

/* ──────────────────── Pending checkout (draft-resume) ──────────────────── */

router.post("/:id/pending-checkout", validate(projectPendingCheckoutSchema), async (req, res) => {
  const ctx = await loadAccessibleProject(req, res);
  if (!ctx) return;
  if (!ctx.isOwner) return res.status(403).json({ error: "owner_only" });
  await prisma.project.update({
    where: { id: ctx.project.id },
    data: {
      pendingCheckoutSessionId: req.validatedBody.sessionId,
      pendingCheckoutSessionAt: new Date(),
    },
  });
  res.json({ ok: true });
});

router.post("/:id/pending-checkout/clear", async (req, res) => {
  const ctx = await loadAccessibleProject(req, res);
  if (!ctx) return;
  if (!ctx.isOwner) return res.status(403).json({ error: "owner_only" });
  await prisma.project.update({
    where: { id: ctx.project.id },
    data: { pendingCheckoutSessionId: null, pendingCheckoutSessionAt: null },
  });
  res.json({ ok: true });
});

/* ──────────────────── Share link (owner or staff) ──────────────────── */

router.post("/:id/share-link", validate(projectShareLinkSchema), async (req, res) => {
  const ctx = await loadAccessibleProject(req, res);
  if (!ctx) return;
  if (!ctx.isOwner && !ctx.isStaff) return res.status(403).json({ error: "forbidden" });
  const out = await issueShareLink(ctx.project.id, req.validatedBody.expiresInDays ?? null);
  await logAuditEvent({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    action: "project.share_link_issued",
    targetType: "project",
    targetId: ctx.project.id,
    metadata: { expiresAt: out.expiresAt?.toISOString?.() ?? null },
    ...requestAuditContext(req),
  });
  const appUrl = String(env.appUrl || "").replace(/\/$/, "");
  res.json({
    token: out.token,
    url: `${appUrl}/share/projects/${out.token}`,
    expiresAt: out.expiresAt?.toISOString?.() ?? null,
  });
});

router.delete("/:id/share-link", async (req, res) => {
  const ctx = await loadAccessibleProject(req, res);
  if (!ctx) return;
  if (!ctx.isOwner && !ctx.isStaff) return res.status(403).json({ error: "forbidden" });
  await revokeShareLink(ctx.project.id);
  await logAuditEvent({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    action: "project.share_link_revoked",
    targetType: "project",
    targetId: ctx.project.id,
    metadata: {},
    ...requestAuditContext(req),
  });
  res.json({ ok: true });
});

/* ──────────────────── Designer heartbeat ("actively working") ──────────────────── */

router.post("/:id/heartbeat", async (req, res) => {
  const ctx = await loadAccessibleProject(req, res, { staffOnly: true });
  if (!ctx) return;
  await prisma.project.update({
    where: { id: ctx.project.id },
    data: { designerHeartbeatAt: new Date(), lastDesignerActivityAt: new Date() },
  });
  res.json({ ok: true });
});

/* ──────────────────── Aggregate: customer multi-project roll-up ──────────────────── */

router.get("/roll-up/summary", async (req, res) => {
  const rows = await prisma.project.findMany({
    where: { ownerUserId: req.auth.userId },
    select: {
      id: true,
      name: true,
      workflowStatus: true,
      assignedDesignerId: true,
      lastDesignerActivityAt: true,
      pendingCheckoutSessionId: true,
      liveUrl: true,
    },
  });
  const buckets = {
    total: rows.length,
    awaitingPayment: rows.filter((p) => p.pendingCheckoutSessionId).length,
    awaitingYourAction: rows.filter((p) =>
      ["awaiting_brief", "awaiting_assets", "in_review", "approved"].includes(p.workflowStatus),
    ).length,
    inProgress: rows.filter((p) => ["in_progress", "revisions_requested", "ready_to_start"].includes(p.workflowStatus)).length,
    live: rows.filter((p) => p.workflowStatus === "live").length,
    onHold: rows.filter((p) => p.workflowStatus === "on_hold").length,
  };
  const unreadCounts = await prisma.projectChatMessage.groupBy({
    by: ["projectId"],
    where: {
      projectId: { in: rows.map((r) => r.id) },
      isStaff: true,
      readByCustomerAt: null,
    },
    _count: { _all: true },
  });
  const unreadMap = new Map(unreadCounts.map((u) => [u.projectId, u._count._all]));
  res.json({
    buckets,
    projects: rows.map((p) => ({
      id: p.id,
      name: p.name,
      workflowStatus: p.workflowStatus,
      unreadCount: unreadMap.get(p.id) ?? 0,
      liveUrl: p.liveUrl,
      pendingPayment: Boolean(p.pendingCheckoutSessionId),
    })),
  });
});

export { router as projectWorkflowRouter };
