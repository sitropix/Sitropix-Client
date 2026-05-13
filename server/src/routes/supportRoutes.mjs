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
import { findPrimaryUserSubscription } from "../services/subscriptionLookup.mjs";
import {
  absoluteTicketAttachmentPath,
  ensureTicketAttachmentsDir,
  safeTicketAttachmentRelativePath,
} from "../services/ticketAttachmentPaths.mjs";
import { projectNameByIdForTickets } from "../services/supportTicketProjectNames.mjs";

const router = express.Router();
router.use(requireAuth);
const ticketUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 5 },
});

router.get("/tickets", async (req, res) => {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: req.auth.userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { messages: true } },
    },
  });
  const projectNames = await projectNameByIdForTickets(tickets);
  return res.json(
    tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      description: t.description,
      status: t.status,
      priority: t.priority,
      department: t.department,
      userPlan: t.userPlan,
      projectId: t.projectId ?? null,
      projectName: (t.projectId && projectNames.get(t.projectId)) || null,
      threadCount: t._count.messages,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  );
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
    status: ticket.status,
    priority: ticket.priority,
    department: ticket.department,
    userPlan: ticket.userPlan,
    projectId: ticket.projectId ?? null,
    projectName: (ticket.projectId && projectNames.get(ticket.projectId)) || null,
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

  const subscription = await findPrimaryUserSubscription(req.auth.userId, {
    include: { plan: { select: { name: true } } },
  });
  const userPlan = subscription?.plan?.name ?? "No Plan";
  
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: req.auth.userId,
      projectId: linkedProjectId,
      subject: payload.subject,
      description: payload.description,
      department: payload.departmentId ?? "General",
      priority: payload.priority ?? "medium",
      userPlan,
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

router.post("/tickets/:id/messages", validate(replyTicketSchema), async (req, res) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: req.params.id, userId: req.auth.userId },
  });
  if (!ticket) return res.status(404).json({ error: "not_found" });
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
