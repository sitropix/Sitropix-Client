import express from "express";
import multer from "multer";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { env } from "../config/env.mjs";
import { prisma } from "../db/client.mjs";
import { requireAuth } from "../middleware/auth.mjs";
import { validate } from "../middleware/validate.mjs";
import { createTicketSchema, replyTicketSchema } from "../schemas/supportSchemas.mjs";
import { log } from "../observability/logger.mjs";
import { sendTransactionalEmail } from "../services/emailService.mjs";
import { findPrimaryUserSubscription, findUserProjectSubscription } from "../services/subscriptionLookup.mjs";
import {
  allocateCreditCharge,
  chargeSubscriptionCreditsTx,
  subscriptionCreditView,
  totalCreditsAvailable,
} from "../services/subscriptionCredits.mjs";
import {
  absoluteTicketAttachmentPath,
  ensureTicketAttachmentsDir,
  safeTicketAttachmentRelativePath,
} from "../services/ticketAttachmentPaths.mjs";
import { projectNameByIdForTickets } from "../services/supportTicketProjectNames.mjs";
import { resolveSupportTicketPriority } from "../services/supportTicketPriority.mjs";
import {
  canUserCloseTicket,
  canUserDeleteTicket,
  canUserReopenTicket,
  refundTicketCreditsIfNeeded,
} from "../services/supportTicketLifecycle.mjs";
import { mapSupportTicketListRow, ticketStatusForApi } from "../services/supportTicketSerialize.mjs";

function insufficientCreditsMessage(needed, available) {
  const creditWord = needed === 1 ? "credit" : "credits";
  const availVerb = available === 1 ? "is" : "are";
  return `This edit requires ${needed} website edit ${creditWord}, but only ${available} ${availVerb} available on this project.`;
}

const router = express.Router();
router.use(requireAuth);
const ticketUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 5 },
});

router.get("/edit-types", async (_req, res) => {
  const rows = await prisma.editType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return res.json(
    rows.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
      category: r.category,
      creditsMin: r.creditsMin,
      creditsMax: r.creditsMax,
      defaultChargeCredits: r.defaultChargeCredits,
    })),
  );
});

router.get("/tickets", async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: req.auth.userId },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      include: {
        _count: { select: { messages: true } },
      },
    });
    const projectNames = await projectNameByIdForTickets(tickets);
    return res.json(tickets.map((t) => mapSupportTicketListRow(t, projectNames)));
  } catch (e) {
    log.error("support.tickets.list_failed", { userId: req.auth.userId, error: e?.message });
    return res.status(500).json({
      error: "tickets_load_failed",
      message: "Could not load support tickets. If this persists, contact support.",
    });
  }
});

router.get("/tickets/:id", async (req, res) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: req.params.id, userId: req.auth.userId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, email: true } } } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) return res.status(404).json({ error: "not_found" });
  const projectNames = await projectNameByIdForTickets([ticket]);
  return res.json({
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    status: ticketStatusForApi(ticket.status),
    priority: ticket.priority,
    department: ticket.department,
    userPlan: ticket.userPlan,
    projectId: ticket.projectId ?? null,
    projectName: (ticket.projectId && projectNames.get(ticket.projectId)) || null,
    editTypeId: ticket.editTypeId ?? null,
    creditsCharged: ticket.creditsCharged ?? 0,
    workCompleted: ticket.workCompleted ?? null,
    creditsRefunded: ticket.creditsRefunded ?? false,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    messages: ticket.messages.map((m) => ({
      id: m.id,
      body: m.body,
      isStaff: m.isStaff,
      createdAt: m.createdAt,
      author: m.user ? { id: m.user.id, name: m.user.name, email: m.user.email } : null,
      attachments: ticket.attachments
        .filter((a) => a.messageId === m.id)
        .map((a) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          createdAt: a.createdAt,
          downloadUrl: `/api/support/tickets/${ticket.id}/attachments/${a.id}/download`,
        })),
    })),
  });
});

router.post("/tickets", ticketUpload.array("attachments", 5), async (req, res) => {
  const payloadResult = createTicketSchema.safeParse({
    subject: req.body?.subject,
    description: req.body?.description,
    departmentId: req.body?.departmentId,
    priority: req.body?.priority,
    projectId: req.body?.projectId,
    editTypeId: req.body?.editTypeId,
  });
  if (!payloadResult.success) {
    return res.status(400).json({ error: "validation_error", issues: payloadResult.error.issues });
  }
  const payload = payloadResult.data;
  const files = Array.isArray(req.files) ? req.files : [];

  let linkedProjectId = null;
  if (payload.projectId?.trim()) {
    const owned = await prisma.project.findFirst({
      where: { id: payload.projectId.trim(), ownerUserId: req.auth.userId },
      select: { id: true },
    });
    if (!owned) {
      return res.status(400).json({ error: "invalid_project", message: "Project not found or not owned by you." });
    }
    linkedProjectId = owned.id;
  }

  let projectSub = null;
  if (linkedProjectId) {
    projectSub = await findUserProjectSubscription(req.auth.userId, linkedProjectId, {
      include: {
        plan: {
          select: {
            code: true,
            name: true,
            catalogJson: true,
            includedEditCreditsPerPeriod: true,
          },
        },
      },
    });
  }

  let userPlan = "No Plan";
  if (linkedProjectId && projectSub) {
    userPlan = projectSub.plan?.name ?? "No Plan";
  } else if (!linkedProjectId) {
    const subscription = await findPrimaryUserSubscription(req.auth.userId, {
      include: { plan: { select: { name: true } } },
    });
    userPlan = subscription?.plan?.name ?? "No Plan";
  }

  let ticketPriority = payload.priority ?? "medium";
  if (linkedProjectId && projectSub && ["active", "trialing"].includes(projectSub.status)) {
    ticketPriority = resolveSupportTicketPriority({
      planCode: projectSub.plan?.code ?? "",
      catalogJson: projectSub.plan?.catalogJson,
      boostUntil: projectSub.supportPriorityBoostUntil,
    });
  }

  let editTypeRow = null;
  let creditCost = 0;
  if (linkedProjectId && payload.editTypeId?.trim()) {
    editTypeRow = await prisma.editType.findFirst({
      where: { id: payload.editTypeId.trim(), isActive: true },
    });
    if (!editTypeRow) {
      return res.status(400).json({ error: "invalid_edit_type", message: "Unknown or inactive edit type." });
    }
    if (!projectSub || !["active", "trialing"].includes(projectSub.status)) {
      return res.status(400).json({
        error: "subscription_required_for_edits",
        message: "An active subscription is required to submit website edit requests for this project.",
      });
    }
    creditCost = Math.max(0, editTypeRow.defaultChargeCredits ?? 0);
    const subForCredits = subscriptionCreditView(projectSub, projectSub.plan);
    const splitPreview = allocateCreditCharge(subForCredits, creditCost);
    if (creditCost > 0 && !splitPreview) {
      const available = totalCreditsAvailable(subForCredits);
      return res.status(400).json({
        error: "insufficient_credits",
        needed: creditCost,
        available,
        message: insufficientCreditsMessage(creditCost, available),
      });
    }
  }

  let ticket;
  try {
    ticket = await prisma.$transaction(
      async (tx) => {
        let creditsCharged = 0;
        let creditsFromIncluded = 0;
        let creditsFromPurchased = 0;
        let editTypeId = null;

        if (linkedProjectId && editTypeRow && projectSub) {
          editTypeId = editTypeRow.id;
          creditsCharged = creditCost;
          if (creditCost > 0) {
            const charged = await chargeSubscriptionCreditsTx(tx, projectSub.id, creditCost);
            if (!charged) {
              const err = new Error("insufficient_credits");
              err.code = "insufficient_credits";
              throw err;
            }
            creditsFromIncluded = charged.fromIncluded;
            creditsFromPurchased = charged.fromPurchased;
          }
        }

        return tx.supportTicket.create({
          data: {
            userId: req.auth.userId,
            projectId: linkedProjectId,
            subject: payload.subject,
            description: payload.description,
            department: payload.departmentId ?? "General",
            priority: ticketPriority,
            userPlan,
            editTypeId,
            creditsCharged,
            creditsFromIncluded,
            creditsFromPurchased,
            messages: {
              create: {
                userId: req.auth.userId,
                isStaff: false,
                body: payload.description,
              },
            },
          },
          include: {
            messages: { orderBy: { createdAt: "asc" } },
          },
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
  } catch (e) {
    if (e?.code === "insufficient_credits") {
      const available =
        projectSub != null
          ? totalCreditsAvailable(subscriptionCreditView(projectSub, projectSub.plan))
          : 0;
      return res.status(400).json({
        error: "insufficient_credits",
        needed: creditCost,
        available,
        message: insufficientCreditsMessage(creditCost, available),
      });
    }
    log.error("ticket.create_failed", { error: e?.message });
    return res.status(500).json({ error: "ticket_create_failed" });
  }
  const firstMessage = ticket.messages[0];
  const projectNames = await projectNameByIdForTickets([ticket]);

  if (files.length > 0 && firstMessage) {
    await ensureTicketAttachmentsDir();
    for (const file of files) {
      if (!file?.buffer?.length) continue;
      const attachment = await prisma.ticketAttachment.create({
        data: {
          ticketId: ticket.id,
          messageId: firstMessage.id,
          uploadedByUserId: req.auth.userId,
          fileName: file.originalname || "attachment",
          mimeType: file.mimetype || "application/octet-stream",
          sizeBytes: file.size,
          storagePath: "_pending_",
        },
      });
      const rel = safeTicketAttachmentRelativePath(ticket.id, attachment.id, file.originalname || "attachment");
      const abs = absoluteTicketAttachmentPath(rel);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, file.buffer);
      await prisma.ticketAttachment.update({
        where: { id: attachment.id },
        data: { storagePath: rel, sizeBytes: file.size },
      });
    }
  }

  await sendTransactionalEmail({
    to: req.auth.email,
    template: "ticket_created",
    idempotencyKey: `ticket_create_${ticket.id}`,
    subject: `Ticket created: ${ticket.subject}`,
    html: `<p>We received your request <strong>#${ticket.id}</strong>. Our team will respond shortly.</p>`,
  });

  const responseBody = {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    department: ticket.department,
    userPlan: ticket.userPlan,
    projectId: ticket.projectId ?? null,
    projectName: (ticket.projectId && projectNames.get(ticket.projectId)) || null,
    editTypeId: ticket.editTypeId ?? null,
    creditsCharged: ticket.creditsCharged ?? 0,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    threadCount: 1,
  };
  res.status(201).json(responseBody);

  // Notify admins outside the request path so ticket creation latency stays stable as admin count grows.
  setImmediate(async () => {
    try {
      const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { email: true } });
      await Promise.all(
        admins.map((a) =>
          sendTransactionalEmail({
            to: a.email,
            template: "ticket_notify_admin",
            idempotencyKey: `ticket_admin_${ticket.id}_${a.email}`,
            subject: `New ticket: ${ticket.subject}`,
            html: `<p>New support ticket from ${req.auth.email}.</p><p><a href="${env.appUrl}/admin/tickets/${ticket.id}">Open in admin</a></p>`,
          }),
        ),
      );
    } catch (e) {
      log.error("ticket.admin_notify_failed", { ticketId: ticket.id, error: e?.message });
    }
  });
  return;
});

router.get("/tickets/:id/attachments/:attachmentId/download", async (req, res) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: req.params.id, userId: req.auth.userId },
    select: { id: true },
  });
  if (!ticket) return res.status(404).json({ error: "not_found" });
  const attachment = await prisma.ticketAttachment.findFirst({
    where: { id: req.params.attachmentId, ticketId: ticket.id },
  });
  if (!attachment) return res.status(404).json({ error: "not_found" });

  const abs = absoluteTicketAttachmentPath(attachment.storagePath);
  try {
    await access(abs);
  } catch {
    return res.status(404).json({ error: "file_missing" });
  }
  const buf = await readFile(abs);
  res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
  return res.send(buf);
});

router.post("/tickets/:id/close", async (req, res) => {
  const existing = await prisma.supportTicket.findFirst({
    where: { id: req.params.id, userId: req.auth.userId },
  });
  if (!existing) return res.status(404).json({ error: "not_found" });
  if (!canUserCloseTicket(existing)) {
    return res.status(400).json({
      error: "cannot_close",
      message: "Only open requests that are not yet resolved can be closed.",
    });
  }

  let creditsRefunded = existing.creditsRefunded;
  await prisma.$transaction(async (tx) => {
    const data = { status: "closed", updatedAt: new Date() };
    const { refunded } = await refundTicketCreditsIfNeeded(tx, existing);
    if (refunded) {
      data.creditsRefunded = true;
      creditsRefunded = true;
    }
    await tx.supportTicket.update({ where: { id: existing.id }, data });
  });

  const ticket = await prisma.supportTicket.findUnique({ where: { id: existing.id } });
  return res.json({
    id: ticket.id,
    status: ticket.status,
    updatedAt: ticket.updatedAt,
    creditsRefunded,
  });
});

router.post("/tickets/:id/reopen", async (req, res) => {
  const existing = await prisma.supportTicket.findFirst({
    where: { id: req.params.id, userId: req.auth.userId },
  });
  if (!existing) return res.status(404).json({ error: "not_found" });
  if (!canUserReopenTicket(existing)) {
    return res.status(400).json({
      error: "cannot_reopen",
      message: "Only closed requests can be reopened.",
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const data = { status: "open", updatedAt: new Date() };

      if (
        (existing.creditsCharged ?? 0) > 0 &&
        existing.creditsRefunded &&
        existing.projectId
      ) {
        const sub = await tx.subscription.findFirst({
          where: {
            userId: existing.userId,
            projectId: existing.projectId,
            status: { not: "canceled" },
          },
          include: { plan: { select: { includedEditCreditsPerPeriod: true, catalogJson: true } } },
        });
        if (!sub) {
          const err = new Error("subscription_required");
          err.code = "subscription_required";
          throw err;
        }
        const charged = await chargeSubscriptionCreditsTx(tx, sub.id, existing.creditsCharged);
        if (!charged) {
          const available = totalCreditsAvailable(subscriptionCreditView(sub, sub.plan));
          const err = new Error("insufficient_credits");
          err.code = "insufficient_credits";
          err.needed = existing.creditsCharged;
          err.available = available;
          throw err;
        }
        data.creditsRefunded = false;
        data.creditsFromIncluded = charged.fromIncluded;
        data.creditsFromPurchased = charged.fromPurchased;
      }

      await tx.supportTicket.update({ where: { id: existing.id }, data });
    });
  } catch (e) {
    if (e?.code === "insufficient_credits") {
      return res.status(400).json({
        error: "insufficient_credits",
        needed: e.needed,
        available: e.available,
        message: insufficientCreditsMessage(e.needed ?? existing.creditsCharged, e.available ?? 0),
      });
    }
    if (e?.code === "subscription_required") {
      return res.status(400).json({
        error: "subscription_required",
        message: "An active subscription is required to reopen this website edit request.",
      });
    }
    log.error("ticket.reopen_failed", { ticketId: existing.id, error: e?.message });
    return res.status(500).json({ error: "ticket_reopen_failed" });
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id: existing.id } });
  return res.json({
    id: ticket.id,
    status: ticket.status,
    updatedAt: ticket.updatedAt,
    creditsRefunded: ticket.creditsRefunded,
  });
});

router.delete("/tickets/:id", async (req, res) => {
  const existing = await prisma.supportTicket.findFirst({
    where: { id: req.params.id, userId: req.auth.userId },
  });
  if (!existing) return res.status(404).json({ error: "not_found" });
  if (!canUserDeleteTicket(existing)) {
    return res.status(400).json({
      error: "cannot_delete",
      message: "Only resolved and completed requests can be deleted.",
    });
  }
  await prisma.supportTicket.delete({ where: { id: existing.id } });
  return res.status(204).end();
});

router.post("/tickets/:id/messages", validate(replyTicketSchema), async (req, res) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: req.params.id, userId: req.auth.userId },
  });
  if (!ticket) return res.status(404).json({ error: "not_found" });
  if (ticket.status === "closed" || ticket.status === "resolved") {
    return res.status(400).json({
      error: "ticket_not_replyable",
      message: "This request is closed and cannot receive new replies.",
    });
  }
  const msg = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      userId: req.auth.userId,
      isStaff: false,
      body: req.validatedBody.body,
    },
  });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { updatedAt: new Date() },
  });
  return res.status(201).json({ id: msg.id, createdAt: msg.createdAt });
});

router.get("/kb/categories", async (_req, res) => {
  const categories = await prisma.kBCategory.findMany({ orderBy: { name: "asc" } });
  return res.json(categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, articleCount: c.articleCount })));
});

router.get("/kb/articles", async (req, res) => {
  const filter = req.query.categoryId ? { categoryId: req.query.categoryId } : {};
  const articles = await prisma.kBArticle.findMany({ where: filter, orderBy: { updatedAt: "desc" } });
  return res.json(
    articles.map((a) => ({
      id: a.id,
      title: a.title,
      excerpt: a.excerpt,
      categoryId: a.categoryId,
      updatedAt: a.updatedAt,
      readTimeMinutes: a.readTimeMinutes,
    })),
  );
});

router.get("/kb/articles/:id", async (req, res) => {
  const article = await prisma.kBArticle.findUnique({ where: { id: req.params.id } });
  if (!article) return res.status(404).json({ error: "not_found" });
  return res.json({
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    categoryId: article.categoryId,
    updatedAt: article.updatedAt,
    readTimeMinutes: article.readTimeMinutes,
    content: article.content,
  });
});

export { router as supportRouter };
