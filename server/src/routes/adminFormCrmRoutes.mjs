import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import express from "express";
import { prisma } from "../db/client.mjs";
import { env } from "../config/env.mjs";
import { requireAuth, requireModuleAccess, requireRole } from "../middleware/auth.mjs";
import { validate } from "../middleware/validate.mjs";
import {
  convertLeadSchema,
  createFormSchema,
  patchFormSchema,
  patchLeadStatusSchema,
  replaceFormFieldsSchema,
} from "../schemas/formCrmSchemas.mjs";
import { isAllowedMeetingUrl } from "../services/crmLeadHelpers.mjs";
import { logAuditEvent, requestAuditContext } from "../services/auditLogService.mjs";
import { log } from "../observability/logger.mjs";

const router = express.Router();
router.use(requireAuth, requireRole("admin", "master_admin"));

const formsRouter = express.Router();
formsRouter.use(requireModuleAccess("forms"));

formsRouter.get("/", async (_req, res) => {
  const rows = await prisma.formDefinition.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { submissions: true, fields: true } },
    },
  });
  return res.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      embedKey: r.embedKey,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      submissionCount: r._count.submissions,
      fieldCount: r._count.fields,
    })),
  });
});

formsRouter.post("/", validate(createFormSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const p = req.validatedBody;
  const embedKey = crypto.randomBytes(20).toString("hex");

  const fieldsData = p.fields
    .map((f, i) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required ?? false,
      fieldOrder: f.fieldOrder ?? i,
      optionsJson: f.optionsJson ?? [],
      validationJson: f.validationJson ?? {},
    }))
    .sort((a, b) => a.fieldOrder - b.fieldOrder);

  try {
    const created = await prisma.formDefinition.create({
      data: {
        name: p.name,
        slug: p.slug,
        isActive: p.isActive ?? true,
        embedKey,
        settingsJson: p.settingsJson ?? {},
        createdById: req.auth.userId,
        fields: {
          create: fieldsData,
        },
      },
      include: { fields: { orderBy: { fieldOrder: "asc" } } },
    });

    await logAuditEvent({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "forms.definition_created",
      targetType: "form_definition",
      targetId: created.id,
      ...auditCtx,
      metadata: { slug: created.slug },
    });

    return res.status(201).json(formatFormDetail(created));
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(409).json({ error: "duplicate_slug_or_key", message: "Slug already in use." });
    }
    throw e;
  }
});

formsRouter.get("/:id", async (req, res) => {
  const form = await prisma.formDefinition.findUnique({
    where: { id: req.params.id },
    include: { fields: { orderBy: { fieldOrder: "asc" } } },
  });
  if (!form) return res.status(404).json({ error: "not_found" });
  return res.json(formatFormDetail(form));
});

formsRouter.patch("/:id", validate(patchFormSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const p = req.validatedBody;
  try {
    const updated = await prisma.formDefinition.update({
      where: { id: req.params.id },
      data: {
        ...(p.name != null ? { name: p.name } : {}),
        ...(p.slug != null ? { slug: p.slug } : {}),
        ...(p.isActive != null ? { isActive: p.isActive } : {}),
        ...(p.settingsJson != null ? { settingsJson: p.settingsJson } : {}),
      },
      include: { fields: { orderBy: { fieldOrder: "asc" } } },
    });

    await logAuditEvent({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "forms.definition_updated",
      targetType: "form_definition",
      targetId: updated.id,
      ...auditCtx,
      metadata: {},
    });

    return res.json(formatFormDetail(updated));
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ error: "not_found" });
    if (e.code === "P2002") return res.status(409).json({ error: "duplicate_slug" });
    throw e;
  }
});

formsRouter.delete("/:id", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const id = req.params.id;
  const existing = await prisma.formDefinition.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "not_found" });
  await prisma.formDefinition.delete({ where: { id } });
  await logAuditEvent({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    action: "forms.definition_deleted",
    targetType: "form_definition",
    targetId: id,
    ...auditCtx,
    metadata: { slug: existing.slug, name: existing.name },
  });
  return res.json({ ok: true });
});

formsRouter.put("/:id/fields", validate(replaceFormFieldsSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const { fields } = req.validatedBody;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.formField.deleteMany({ where: { formId: req.params.id } });
      const sorted = [...fields].sort((a, b) => (a.fieldOrder ?? 0) - (b.fieldOrder ?? 0));
      await tx.formField.createMany({
        data: sorted.map((f, i) => ({
          formId: req.params.id,
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required ?? false,
          fieldOrder: f.fieldOrder ?? i,
          optionsJson: f.optionsJson ?? [],
          validationJson: f.validationJson ?? {},
        })),
      });
    });

    const form = await prisma.formDefinition.findUnique({
      where: { id: req.params.id },
      include: { fields: { orderBy: { fieldOrder: "asc" } } },
    });
    if (!form) return res.status(404).json({ error: "not_found" });

    await logAuditEvent({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "forms.fields_replaced",
      targetType: "form_definition",
      targetId: form.id,
      ...auditCtx,
      metadata: { count: fields.length },
    });

    return res.json(formatFormDetail(form));
  } catch (e) {
    log.errorReq(req, "forms.fields_replace_failed", {
      formId: req.params.id,
      error: e?.message,
      code: e?.code,
    });
    return res.status(400).json({ error: "update_failed", message: "Could not replace fields. Check the field definitions and try again." });
  }
});

formsRouter.get("/:id/embed", async (req, res) => {
  const form = await prisma.formDefinition.findUnique({ where: { id: req.params.id } });
  if (!form) return res.status(404).json({ error: "not_found" });

  const appUrl = String(env.appUrl || "http://127.0.0.1:5173").replace(/\/$/, "");
  const apiBase = `${appUrl}/api`;
  const token = form.embedKey;
  const iframeSrc = `${appUrl}/embed/form/${token}`;

  const snippet =
    `<!-- Sitropix lead form: POST ${apiBase}/v1/forms/${token}/submit (JSON, include csrfToken from GET .../config) -->\n` +
    `<iframe title="${escapeAttr(form.name)}" src="${iframeSrc}" width="100%" height="720" frameborder="0"></iframe>`;

  const scriptInner =
    `!(function(){var T=${JSON.stringify(token)},B=${JSON.stringify(apiBase)},U=${JSON.stringify(appUrl)};` +
    `var d=document.createElement("iframe");d.src=U+"/embed/form/"+T;d.width="100%";d.height="720";d.setAttribute("frameborder","0");` +
    `(document.currentScript||document.body).insertAdjacentElement("afterend",d);})();`;

  const scriptSnippet = `<script nonce="__CSP_NONCE__">\n${scriptInner}\n</script>`;

  return res.json({
    formPublicToken: token,
    embedKey: form.embedKey,
    submitUrl: `${apiBase}/forms/${token}/submit`,
    submitUrlV1: `${apiBase}/v1/forms/${token}/submit`,
    configUrl: `${apiBase}/forms/${token}/config`,
    configUrlV1: `${apiBase}/v1/forms/${token}/config`,
    iframeSrc,
    htmlSnippet: snippet,
    scriptSnippet,
    cspNoncePlaceholder: "__CSP_NONCE__",
  });
});

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function formatFormDetail(form) {
  return {
    id: form.id,
    name: form.name,
    slug: form.slug,
    embedKey: form.embedKey,
    isActive: form.isActive,
    settingsJson: form.settingsJson ?? {},
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
    fields: (form.fields ?? []).map((f) => ({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      fieldOrder: f.fieldOrder,
      optionsJson: f.optionsJson,
      validationJson: f.validationJson,
    })),
  };
}

const crmRouter = express.Router();
crmRouter.use(requireModuleAccess("crm"));

crmRouter.get("/leads", async (req, res) => {
  const {
    status,
    formId,
    search,
    limit = "50",
    offset = "0",
  } = req.query;

  const where = {};
  if (status && typeof status === "string") {
    const allowed = ["NEW", "MEETING_SCHEDULED", "YET_TO_CONTACT", "CONTACTED", "HOLD"];
    if (allowed.includes(status)) where.status = status;
  }
  if (formId && typeof formId === "string") where.formId = formId;

  if (search && typeof search === "string" && search.trim()) {
    const q = search.trim();
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
    ];
  }

  const take = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
  const skip = Math.max(0, parseInt(String(offset), 10) || 0);

  const [items, total] = await Promise.all([
    prisma.crmLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        form: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.crmLead.count({ where }),
  ]);

  return res.json({
    items: items.map((l) => ({
      id: l.id,
      formId: l.formId,
      formName: l.form.name,
      fullName: l.fullName,
      email: l.email,
      phone: l.phone,
      company: l.company,
      status: l.status,
      meetingLink: l.meetingLink,
      meetingScheduledAt: l.meetingScheduledAt,
      convertedAt: l.convertedAt,
      convertedCustomerId: l.convertedCustomerId,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
    total,
  });
});

crmRouter.get("/leads/:id", async (req, res) => {
  const lead = await prisma.crmLead.findUnique({
    where: { id: req.params.id },
    include: {
      form: { select: { id: true, name: true, slug: true, embedKey: true } },
      submission: true,
      convertedCustomer: {
        select: { id: true, email: true, name: true, phoneNumber: true, createdAt: true },
      },
      statusLogs: {
        orderBy: { changedAt: "desc" },
        include: {
          changedBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!lead) return res.status(404).json({ error: "not_found" });

  return res.json({
    lead: {
      id: lead.id,
      status: lead.status,
      meetingLink: lead.meetingLink,
      meetingScheduledAt: lead.meetingScheduledAt,
      notes: lead.notes,
      fullName: lead.fullName,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      convertedAt: lead.convertedAt,
      convertedCustomerId: lead.convertedCustomerId,
      convertedCustomer: lead.convertedCustomer,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      form: lead.form,
    },
    submission: {
      id: lead.submission.id,
      payloadJson: lead.submission.payloadJson,
      sourceUrl: lead.submission.sourceUrl,
      sourceReferrer: lead.submission.sourceReferrer,
      utmJson: lead.submission.utmJson,
      submittedAt: lead.submission.submittedAt,
      calBookingId: lead.submission.calBookingId,
      meetingUrlAtSubmit: lead.submission.meetingUrlAtSubmit,
      calMeetingDetailsJson: lead.submission.calMeetingDetailsJson ?? null,
    },
    statusLogs: lead.statusLogs.map((log) => ({
      id: log.id,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      meetingLink: log.meetingLink,
      changedAt: log.changedAt,
      reason: log.reason,
      changedBy: log.changedBy,
    })),
  });
});

crmRouter.patch("/leads/:id/status", validate(patchLeadStatusSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const { toStatus, meetingLink, reason } = req.validatedBody;

  if (toStatus === "MEETING_SCHEDULED") {
    const link = meetingLink?.trim();
    if (!link || !isAllowedMeetingUrl(link)) {
      return res.status(400).json({
        error: "meeting_link_required",
        message: 'Status "Meeting Scheduled" requires a valid HTTPS Cal.com meeting URL.',
      });
    }
  }

  const lead = await prisma.crmLead.findUnique({ where: { id: req.params.id } });
  if (!lead) return res.status(404).json({ error: "not_found" });
  if (lead.convertedAt) return res.status(400).json({ error: "already_converted" });

  const fromStatus = lead.status;
  let nextMeetingLink = lead.meetingLink;
  let nextMeetingAt = lead.meetingScheduledAt;

  if (toStatus === "MEETING_SCHEDULED") {
    nextMeetingLink = meetingLink.trim();
    nextMeetingAt = lead.meetingScheduledAt ?? new Date();
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.crmLeadStatusLog.create({
      data: {
        leadId: lead.id,
        fromStatus,
        toStatus,
        meetingLink: toStatus === "MEETING_SCHEDULED" ? nextMeetingLink : meetingLink?.trim() || null,
        changedById: req.auth.userId,
        reason: reason ?? null,
      },
    });

    return tx.crmLead.update({
      where: { id: lead.id },
      data: {
        status: toStatus,
        meetingLink: nextMeetingLink,
        meetingScheduledAt: nextMeetingAt,
      },
    });
  });

  await logAuditEvent({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    action: "crm.lead_status_updated",
    targetType: "crm_lead",
    targetId: lead.id,
    ...auditCtx,
    metadata: { fromStatus, toStatus },
  });

  return res.json({
    id: updated.id,
    status: updated.status,
    meetingLink: updated.meetingLink,
    meetingScheduledAt: updated.meetingScheduledAt,
  });
});

crmRouter.post("/leads/:id/convert", validate(convertLeadSchema), async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const lead = await prisma.crmLead.findUnique({
    where: { id: req.params.id },
    include: { submission: true },
  });
  if (!lead) return res.status(404).json({ error: "not_found" });
  if (lead.convertedAt) return res.status(400).json({ error: "already_converted" });

  const email = lead.email?.trim().toLowerCase();
  if (!email) {
    return res.status(400).json({
      error: "email_required_on_lead",
      message: "Lead must have an email (from form) to convert to a customer account.",
    });
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    // Refuse to silently attach a public-form lead to a privileged account. Anyone can submit a public form with a staff email; if an admin clicks "convert" the lead would be tied to that staff account and pollute the audit trail / enable social-engineering pivots.
    if (existing.role && existing.role !== "user") {
      await logAuditEvent({
        actorUserId: req.auth.userId,
        actorRole: req.auth.role,
        action: "crm.lead_convert_refused_privileged",
        targetType: "crm_lead",
        targetId: lead.id,
        ...auditCtx,
        metadata: { matchedUserId: existing.id, matchedRole: existing.role, email },
      });
      return res.status(409).json({
        error: "matched_user_is_privileged",
        message: "An account with this email exists but is not a customer account; refusing to auto-link. Convert manually if intended.",
      });
    }

    const updated = await prisma.crmLead.update({
      where: { id: lead.id },
      data: {
        convertedCustomerId: existing.id,
        convertedAt: new Date(),
      },
    });

    await logAuditEvent({
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "crm.lead_converted_linked",
      targetType: "crm_lead",
      targetId: lead.id,
      ...auditCtx,
      metadata: { userId: existing.id },
    });

    return res.json({
      ok: true,
      mode: "linked_existing_user",
      userId: existing.id,
      leadId: updated.id,
    });
  }

  if (!req.validatedBody.createUserIfNeeded) {
    return res.status(409).json({
      error: "user_email_available",
      message: "No user with this email. Enable createUserIfNeeded or invite manually.",
    });
  }

  const placeholderPassword = crypto.randomBytes(24).toString("hex");
  const passwordHash = await bcrypt.hash(placeholderPassword, 12);
  const nameFromLead = lead.fullName?.trim() || email.split("@")[0];

  const user = await prisma.user.create({
    data: {
      email,
      name: nameFromLead,
      passwordHash,
      phoneNumber: lead.phone?.trim() || null,
      role: "user",
      isEmailVerified: false,
      isActive: true,
    },
  });

  await prisma.crmLead.update({
    where: { id: lead.id },
    data: {
      convertedCustomerId: user.id,
      convertedAt: new Date(),
    },
  });

  await logAuditEvent({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    action: "crm.lead_converted_new_user",
    targetType: "crm_lead",
    targetId: lead.id,
    ...auditCtx,
    metadata: { userId: user.id },
  });

  return res.json({
    ok: true,
    mode: "created_user",
    userId: user.id,
    leadId: lead.id,
    note: "User created with random password; use password reset flow before first login.",
  });
});

router.use("/forms", formsRouter);
router.use("/crm", crmRouter);

export { router as adminFormCrmRouter };
