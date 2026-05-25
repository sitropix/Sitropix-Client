import express from "express";
import { prisma } from "../db/client.mjs";
import { requireAuth, requireModuleAccess, requireRole } from "../middleware/auth.mjs";
import { validate } from "../middleware/validate.mjs";
import { replyTicketSchema, updateTicketStatusSchema } from "../schemas/supportSchemas.mjs";
import { sendTransactionalEmail } from "../services/emailService.mjs";
import { env } from "../config/env.mjs";
import { readTicketAttachmentBytes } from "../services/storedDocumentBlob.mjs";
import { projectNameByIdForTickets } from "../services/supportTicketProjectNames.mjs";
import {
  enrichAdminTicketDetailForApi,
  enrichAdminTicketsForApi,
} from "../services/supportTicketEnrichment.mjs";
import { ticketStatusForApi } from "../services/supportTicketSerialize.mjs";
import { refundSubscriptionCreditsTx } from "../services/subscriptionCredits.mjs";
import { markAddonUtilizedOnTicketResolvedTx } from "../services/addonUtilizationTracking.mjs";
import { escapeHtml } from "../utils/htmlEscape.mjs";

const router = express.Router();
router.use(requireAuth, requireRole("admin", "master_admin", "support"), requireModuleAccess("tickets"));

router.get("/tickets", async (req, res) => {
  const { status, userId, priority, categoryScope, limit = "50", offset = "0" } = req.query;
  const where = {};
  if (status && ["open", "in_progress", "hold", "resolved", "closed"].includes(String(status))) {
    where.status = String(status);
  }
  if (userId) where.userId = String(userId);
  if (priority && ["low", "medium", "high", "urgent"].includes(String(priority))) {
    where.priority = String(priority);
  }
  const scope = String(categoryScope ?? "").trim();
  if (scope === "general") {
    where.category = "general";
  } else if (scope === "non_general") {
    where.category = { in: ["edit", "addon"] };
  }

  const take = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
  const skip = Math.max(0, parseInt(String(offset), 10) || 0);

  const [rows, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take,
      skip,
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  const projectNames = await projectNameByIdForTickets(rows);
  const items = await enrichAdminTicketsForApi(rows, projectNames);
  return res.json({
    items,
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
  const projectNames = await projectNameByIdForTickets([ticket]);
  return res.json(await enrichAdminTicketDetailForApi(ticket, projectNames));
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

  let buf;
  try {
    buf = await readTicketAttachmentBytes(attachment);
  } catch (e) {
    if (e?.code === "file_missing") return res.status(404).json({ error: "file_missing" });
    throw e;
  }
  res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
  return res.send(buf);
});

router.patch("/tickets/:id", validate(updateTicketStatusSchema), async (req, res) => {
  const { status, workCompleted } = req.validatedBody;
  const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "not_found" });
  if (existing.status === "closed") {
    return res.status(400).json({
      error: "ticket_closed",
      message: "This request was closed by the customer. Only the customer can reopen it.",
    });
  }

  const becomingResolved = status === "resolved" && existing.status !== "resolved";
  const treatAsCompleted = workCompleted !== false;

  await prisma.$transaction(async (tx) => {
    const data = { status, updatedAt: new Date() };
    if (becomingResolved) {
      data.workCompleted = treatAsCompleted;
      if (
        !treatAsCompleted &&
        existing.creditsCharged > 0 &&
        !existing.creditsRefunded &&
        existing.projectId
      ) {
        const sub = await tx.subscription.findFirst({
          where: {
            userId: existing.userId,
            projectId: existing.projectId,
            status: { not: "canceled" },
          },
        });
        if (sub) {
          await refundSubscriptionCreditsTx(
            tx,
            sub.id,
            existing.creditsFromIncluded,
            existing.creditsFromPurchased,
          );
          data.creditsRefunded = true;
        }
      }
    }
    await tx.supportTicket.update({
      where: { id: existing.id },
      data,
    });

    if (becomingResolved && existing.category === "addon") {
      const updatedTicket = await tx.supportTicket.findUnique({ where: { id: existing.id } });
      await markAddonUtilizedOnTicketResolvedTx(tx, updatedTicket ?? existing, {
        workCompleted: treatAsCompleted,
      });
    }
  });

  const ticket = await prisma.supportTicket.findUnique({ where: { id: existing.id } });
  return res.json({
    id: ticket.id,
    status: ticketStatusForApi(ticket.status),
    updatedAt: ticket.updatedAt,
    creditsRefunded: ticket.creditsRefunded,
    workCompleted: ticket.workCompleted,
  });
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
    html: `<p>Hi ${escapeHtml(ticket.user.name)},</p><p>Our team added a reply to your ticket <strong>#${escapeHtml(ticket.id)}</strong>:</p><blockquote>${escapeHtml(req.validatedBody.body)}</blockquote><p><a href="${env.appUrl}/support/tickets/${encodeURIComponent(ticket.id)}">View conversation</a></p>`,
  });

  return res.status(201).json({ id: msg.id, createdAt: msg.createdAt, status: nextStatus });
});

export { router as adminSupportRouter };
