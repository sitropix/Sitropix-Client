import express from "express";
import { env } from "../config/env.mjs";
import { prisma } from "../db/client.mjs";
import { requireAuth } from "../middleware/auth.mjs";
import { validate } from "../middleware/validate.mjs";
import { createTicketSchema, replyTicketSchema } from "../schemas/supportSchemas.mjs";
import { log } from "../observability/logger.mjs";
import { sendTransactionalEmail } from "../services/emailService.mjs";

const router = express.Router();
router.use(requireAuth);

router.get("/tickets", async (req, res) => {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId: req.auth.userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });
  return res.json(
    tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      description: t.description,
      status: t.status,
      priority: t.priority,
      department: t.department,
      userPlan: t.userPlan,
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
    messages: ticket.messages.map((m) => ({
      id: m.id,
      body: m.body,
      isStaff: m.isStaff,
      createdAt: m.createdAt,
      author: m.user ? { id: m.user.id, name: m.user.name, email: m.user.email } : null,
    })),
  });
});

router.post("/tickets", validate(createTicketSchema), async (req, res) => {
  const payload = req.validatedBody;
  
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.auth.userId },
    include: { plan: { select: { name: true } } },
  });
  const userPlan = subscription?.plan?.name ?? "No Plan";
  
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: req.auth.userId,
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
  });

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
    data: { status: "open", updatedAt: new Date() },
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
