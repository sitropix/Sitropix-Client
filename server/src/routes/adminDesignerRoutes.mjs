import express from "express";
import { prisma } from "../db/client.mjs";
import { requireAuth, requireModuleAccess, requireRole } from "../middleware/auth.mjs";
import { validate } from "../middleware/validate.mjs";
import { logAuditEvent, requestAuditContext } from "../services/auditLogService.mjs";
import {
  WORKFLOW_LABEL,
  workflowSnapshot,
} from "../services/projectWorkflowService.mjs";
import { runWeeklyDigestForAllCustomers, buildWeeklyDigestForCustomer } from "../services/projectDigestService.mjs";
import { projectAssignSchema } from "../schemas/projectWorkflowSchemas.mjs";

const router = express.Router();
router.use(requireAuth, requireRole("admin", "master_admin", "support"), requireModuleAccess("designer"));

/**
 * List of staff users that can be assigned as a designer.
 * Master admin sees everyone with a staff role; others see same set.
 */
router.get("/staff", async (_req, res) => {
  const rows = await prisma.user.findMany({
    where: {
      role: { in: ["admin", "master_admin", "support"] },
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  res.json({ items: rows });
});

/**
 * Designer queue: projects assigned to the requesting staff user (or all if ?scope=all and admin).
 * Grouped client-side; we return a flat list with workflow + last-activity for sorting.
 */
router.get("/queue", async (req, res) => {
  const scope = String(req.query.scope ?? "mine");
  const where = scope === "all" && ["admin", "master_admin"].includes(req.auth.role)
    ? {}
    : { assignedDesignerId: req.auth.userId };
  if (req.query.status) {
    where.workflowStatus = String(req.query.status);
  }
  const rows = await prisma.project.findMany({
    where,
    orderBy: [{ workflowChangedAt: "desc" }, { updatedAt: "desc" }],
    include: {
      owner: { select: { id: true, name: true, email: true } },
      assignedDesigner: { select: { id: true, name: true } },
    },
    take: 200,
  });
  // Unread (customer→staff) counts so designer sees "you have N unanswered" pings.
  const unread = await prisma.projectChatMessage.groupBy({
    by: ["projectId"],
    where: {
      projectId: { in: rows.map((r) => r.id) },
      isStaff: false,
      readByStaffAt: null,
    },
    _count: { _all: true },
  });
  const unreadMap = new Map(unread.map((u) => [u.projectId, u._count._all]));
  res.json({
    scope: scope === "all" ? "all" : "mine",
    items: rows.map((p) => ({
      id: p.id,
      name: p.name,
      ownerName: p.owner?.name ?? null,
      ownerEmail: p.owner?.email ?? null,
      workflowStatus: p.workflowStatus,
      workflowLabel: WORKFLOW_LABEL[p.workflowStatus] ?? p.workflowStatus,
      workflowChangedAt: p.workflowChangedAt?.toISOString?.() ?? null,
      lastCustomerActivityAt: p.lastCustomerActivityAt?.toISOString?.() ?? null,
      lastDesignerActivityAt: p.lastDesignerActivityAt?.toISOString?.() ?? null,
      assignedDesigner: p.assignedDesigner
        ? { id: p.assignedDesigner.id, name: p.assignedDesigner.name }
        : null,
      unreadFromCustomer: unreadMap.get(p.id) ?? 0,
      planName: p.planName ?? null,
      subscriptionStatus: p.subscriptionStatus,
    })),
  });
});

/** Cross-team board: all projects bucketed by workflow status, for the admin Kanban. */
router.get("/board", async (_req, res) => {
  const rows = await prisma.project.findMany({
    orderBy: { workflowChangedAt: "desc" },
    include: {
      owner: { select: { id: true, name: true } },
      assignedDesigner: { select: { id: true, name: true } },
    },
    take: 500,
  });
  const buckets = {};
  for (const status of Object.keys(WORKFLOW_LABEL)) buckets[status] = [];
  for (const p of rows) {
    const key = buckets[p.workflowStatus] ? p.workflowStatus : "in_progress";
    buckets[key].push({
      id: p.id,
      name: p.name,
      ownerName: p.owner?.name ?? null,
      designerName: p.assignedDesigner?.name ?? null,
      workflowChangedAt: p.workflowChangedAt?.toISOString?.() ?? null,
    });
  }
  res.json({ buckets, labels: WORKFLOW_LABEL });
});

/** Reassign a project to a designer (or unassign by passing null). */
router.patch("/projects/:id/assign", validate(projectAssignSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "project_not_found" });
  const next = req.validatedBody.designerUserId;
  if (next) {
    const designer = await prisma.user.findUnique({ where: { id: next } });
    if (!designer || !["admin", "master_admin", "support"].includes(designer.role)) {
      return res.status(400).json({ error: "invalid_designer" });
    }
  }
  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { assignedDesignerId: next },
    include: { assignedDesigner: true },
  });
  await logAuditEvent({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    action: "project.designer_assigned",
    targetType: "project",
    targetId: project.id,
    metadata: { previousDesignerId: project.assignedDesignerId, newDesignerId: next },
    ...auditCtx,
  });
  res.json(workflowSnapshot(updated, updated.assignedDesigner));
});

/** Aggregate dashboard data for the admin home (overview tiles). */
router.get("/overview", async (_req, res) => {
  const [totalProjects, awaitingAssignment, awaitingCustomer, inReview, live, onHold, stuckProjects] = await Promise.all([
    prisma.project.count(),
    prisma.project.count({ where: { assignedDesignerId: null, workflowStatus: { notIn: ["live", "on_hold"] } } }),
    prisma.project.count({ where: { workflowStatus: "awaiting_customer_reply" } }),
    prisma.project.count({ where: { workflowStatus: "in_review" } }),
    prisma.project.count({ where: { workflowStatus: "live" } }),
    prisma.project.count({ where: { workflowStatus: "on_hold" } }),
    prisma.project.findMany({
      where: {
        workflowChangedAt: { lte: new Date(Date.now() - 7 * 86_400_000) },
        workflowStatus: { notIn: ["live", "on_hold", "approved"] },
      },
      orderBy: { workflowChangedAt: "asc" },
      include: {
        owner: { select: { name: true } },
        assignedDesigner: { select: { name: true } },
      },
      take: 25,
    }),
  ]);
  res.json({
    totals: { totalProjects, awaitingAssignment, awaitingCustomer, inReview, live, onHold },
    stuckProjects: stuckProjects.map((p) => ({
      id: p.id,
      name: p.name,
      ownerName: p.owner?.name ?? null,
      designerName: p.assignedDesigner?.name ?? null,
      workflowStatus: p.workflowStatus,
      workflowChangedAt: p.workflowChangedAt?.toISOString?.() ?? null,
      daysStuck: Math.floor((Date.now() - new Date(p.workflowChangedAt).getTime()) / 86_400_000),
    })),
  });
});

/** Preview a digest for a single customer (no email sent). Admin-only — it returns the customer's email content. */
router.get("/digest/preview/:userId", requireRole("admin", "master_admin"), async (req, res) => {
  const digest = await buildWeeklyDigestForCustomer(req.params.userId);
  res.json(digest ?? { empty: true });
});

/** Trigger the weekly digest immediately. Admin-only. Sends real emails. */
router.post("/digest/run-now", requireRole("admin", "master_admin"), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const out = await runWeeklyDigestForAllCustomers();
  await logAuditEvent({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    action: "admin.weekly_digest_run",
    targetType: "weekly_digest",
    metadata: out,
    ...auditCtx,
  });
  res.json(out);
});

export { router as adminDesignerRouter };
