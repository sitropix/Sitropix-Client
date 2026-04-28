import express from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db/client.mjs";
import { env } from "../config/env.mjs";
import { validate } from "../middleware/validate.mjs";
import { publicSubmitSchema } from "../schemas/formCrmSchemas.mjs";
import { extractLeadContact, hashIp, isAllowedMeetingUrl } from "../services/crmLeadHelpers.mjs";
import { validateFormAnswers } from "../services/formAnswerValidation.mjs";
import { sanitizePayloadValues } from "../services/formInputSanitize.mjs";
import { logAuditEvent, requestAuditContext } from "../services/auditLogService.mjs";
import { issueFormCsrfToken, verifyFormCsrfToken } from "../utils/formCsrf.mjs";

const router = express.Router();

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

function normalizeOrigins(settings) {
  const raw = settings?.allowedOrigins;
  if (!Array.isArray(raw)) return null;
  return raw.map((o) => String(o).trim().toLowerCase()).filter(Boolean);
}

function originAllowed(req, allowedList) {
  if (!allowedList || allowedList.length === 0) return true;
  const origin = req.get("origin")?.toLowerCase() || "";
  const referer = req.get("referer") || "";
  let refOrigin = "";
  try {
    if (referer) refOrigin = new URL(referer).origin.toLowerCase();
  } catch {
    /* ignore */
  }
  const candidates = [origin, refOrigin].filter(Boolean);
  return candidates.some((c) => allowedList.includes(c));
}

function readCalIntegration(settings) {
  return settings?.calIntegration === true || settings?.calIntegration === "true";
}

router.get("/:embedKey/config", async (req, res) => {
  const { embedKey } = req.params;
  const form = await prisma.formDefinition.findFirst({
    where: { embedKey, isActive: true },
    include: {
      fields: { orderBy: { fieldOrder: "asc" } },
    },
  });
  if (!form) return res.status(404).json({ error: "form_not_found" });

  const settings = form.settingsJson && typeof form.settingsJson === "object" ? form.settingsJson : {};
  const calIntegration = readCalIntegration(settings);
  const csrfToken = issueFormCsrfToken(embedKey);

  return res.json({
    schemaVersion: "1",
    id: form.id,
    /** Same value as `embedKey`; use this in LLM / external docs as `formPublicToken`. */
    formPublicToken: embedKey,
    embedKey,
    name: form.name,
    slug: form.slug,
    csrfToken,
    settings: {
      calEmbedUrl: settings.calEmbedUrl ?? null,
      calIntegration,
      allowedOrigins: settings.allowedOrigins ?? [],
    },
    fields: form.fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      optionsJson: f.optionsJson,
      validationJson: f.validationJson,
    })),
  });
});

router.post("/:embedKey/submit", submitLimiter, validate(publicSubmitSchema), async (req, res) => {
  const { embedKey } = req.params;
  const body = req.validatedBody;

  const form = await prisma.formDefinition.findFirst({
    where: { embedKey, isActive: true },
    include: {
      fields: { orderBy: { fieldOrder: "asc" } },
    },
  });
  if (!form) return res.status(404).json({ error: "form_not_found" });

  if (!env.formPublicCsrfDisabled) {
    if (!verifyFormCsrfToken(body.csrfToken, embedKey)) {
      return res.status(403).json({
        error: "csrf_invalid",
        message: "Missing or invalid csrfToken. Call GET .../config first and send csrfToken with submit.",
      });
    }
  }

  const settings = form.settingsJson && typeof form.settingsJson === "object" ? form.settingsJson : {};
  const allowedList = normalizeOrigins(settings);
  if (!originAllowed(req, allowedList)) {
    return res.status(403).json({ error: "origin_not_allowed" });
  }

  let meetingUrl = body.meetingUrl?.trim() || null;
  if (meetingUrl && !isAllowedMeetingUrl(meetingUrl)) {
    return res.status(400).json({ error: "invalid_meeting_url", message: "Meeting URL must be an allowed HTTPS Cal link." });
  }

  const calIntegration = readCalIntegration(settings);
  const hasBooking = Boolean(body.calBookingId?.trim());
  const hasMeeting = Boolean(meetingUrl || hasBooking);
  if (calIntegration && !hasMeeting && !body.schedulingSkipped) {
    return res.status(400).json({
      error: "scheduling_required_or_skip",
      message: "Complete Cal scheduling or set schedulingSkipped: true in the submit payload.",
    });
  }

  const { values, issues } = validateFormAnswers(form.fields, body.answers);
  if (issues.length > 0) {
    return res.status(400).json({
      error: "validation_error",
      message: "Please correct the highlighted fields and try again.",
      issues,
    });
  }

  const sanitized = sanitizePayloadValues(values);

  const initialStatus = hasMeeting ? "MEETING_SCHEDULED" : "YET_TO_CONTACT";

  const contact = extractLeadContact(form.fields, sanitized);

  const ipHash = hashIp(req.ip);
  const auditCtx = requestAuditContext(req);

  const utmMerged = {
    ...(body.utmJson ?? {}),
    ...(body.submittedAt ? { _clientSubmittedAt: body.submittedAt } : {}),
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const submission = await tx.formSubmission.create({
        data: {
          formId: form.id,
          payloadJson: sanitized,
          sourceUrl: body.sourceUrl ?? null,
          sourceReferrer: body.sourceReferrer ?? null,
          utmJson: utmMerged,
          ipHash,
          userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
          calBookingId: body.calBookingId?.trim() || null,
          meetingUrlAtSubmit: meetingUrl,
        },
      });

      const lead = await tx.crmLead.create({
        data: {
          formId: form.id,
          submissionId: submission.id,
          fullName: contact.fullName,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          status: initialStatus,
          meetingLink: meetingUrl,
          meetingScheduledAt: hasMeeting ? new Date() : null,
        },
      });

      await tx.crmLeadStatusLog.create({
        data: {
          leadId: lead.id,
          fromStatus: null,
          toStatus: initialStatus,
          meetingLink: meetingUrl,
          changedById: null,
          reason: "form_submit",
        },
      });

      return { submissionId: submission.id, leadId: lead.id };
    });

    await logAuditEvent({
      actorUserId: null,
      actorRole: null,
      action: "crm.lead_created_public",
      targetType: "crm_lead",
      targetId: result.leadId,
      ...auditCtx,
      metadata: { formId: form.id, embedKey },
    });

    return res.status(201).json({
      ok: true,
      submissionId: result.submissionId,
      leadId: result.leadId,
      status: initialStatus,
      submittedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: "submit_failed", message: e?.message ?? "error" });
  }
});

export { router as formPublicRouter };
