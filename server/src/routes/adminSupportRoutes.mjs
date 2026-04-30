import express from "express";
import { access, readFile } from "node:fs/promises";
import { prisma } from "../db/client.mjs";
import { requireAuth, requireModuleAccess, requireRole } from "../middleware/auth.mjs";
import { validate } from "../middleware/validate.mjs";
import { replyTicketSchema, updateTicketStatusSchema } from "../schemas/supportSchemas.mjs";
import { sendTransactionalEmail } from "../services/emailService.mjs";
import { env } from "../config/env.mjs";
import { absoluteTicketAttachmentPath } from "../services/ticketAttachmentPaths.mjs";

const router = express.Router();
router.use(requireAuth, requireRole("admin", "master_admin"), requireModuleAccess("tickets"));

router.get("/tickets", async (req, res) => {
  const { status, userId, limit = "50", offset = "0" } = req.query;
  const where = {};
  if (status && ["open", "in_progress", "hold", "resolved"].includes(String(status))) {
    where.status = String(status);
  }
  if (userId) where.userId = String(userId);

  const take = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
  const skip = Math.max(0, parseInt(String(offset), 10) || 0);

  const [rows, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take,
      skip,
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return res.json({
    items: rows.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      department: t.department,
      userPlan: t.userPlan,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      threadCount: t._count.messages,
      user: t.user,
    })),
    total,
    take,
    skip,
  });
});

router.get("/tickets/:id", async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) return res.status(404).json({ error: "not_found" });
  return res.json({
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    department: ticket.department,
    userPlan: ticket.userPlan,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    user: ticket.user,
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
          downloadUrl: `/api/admin/tickets/${ticket.id}/attachments/${a.id}/download`,
        })),
    })),
  });
});

router.get("/tickets/:id/attachments/:attachmentId/download", async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
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

router.patch("/tickets/:id", validate(updateTicketStatusSchema), async (req, res) => {
  const { status } = req.validatedBody;
  const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "not_found" });
  const ticket = await prisma.supportTicket.update({
    where: { id: existing.id },
    data: { status, updatedAt: new Date() },
  });
  return res.json({ id: ticket.id, status: ticket.status, updatedAt: ticket.updatedAt });
});

router.post("/tickets/:id/messages", validate(replyTicketSchema), async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!ticket) return res.status(404).json({ error: "not_found" });
  const msg = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      userId: req.auth.userId,
      isStaff: true,
      body: req.validatedBody.body,
    },
  });
  const nextStatus = ticket.status === "resolved" ? "open" : ticket.status === "open" ? "in_progress" : ticket.status;
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: nextStatus, updatedAt: new Date() },
  });

  await sendTransactionalEmail({
    to: ticket.user.email,
    template: "ticket_reply",
    idempotencyKey: `ticket_reply_${ticket.id}_${msg.id}`,
    subject: `Update on your ticket: ${ticket.subject}`,
    html: `<p>Hi ${ticket.user.name},</p><p>Our team added a reply to your ticket <strong>#${ticket.id}</strong>:</p><blockquote>${req.validatedBody.body.replace(/</g, "&lt;")}</blockquote><p><a href="${env.appUrl}/support/tickets/${ticket.id}">View conversation</a></p>`,
  });

  return res.status(201).json({ id: msg.id, createdAt: msg.createdAt, status: nextStatus });
});

export { router as adminSupportRouter };
