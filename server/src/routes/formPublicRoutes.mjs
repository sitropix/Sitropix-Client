import express from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db/client.mjs";
import { env } from "../config/env.mjs";
import { validate } from "../middleware/validate.mjs";
import { publicSubmitSchema } from "../schemas/formCrmSchemas.mjs";
import {
  extractLeadContact,
  hashIp,
  isAllowedPublicMeetingUrl,
} from "../services/crmLeadHelpers.mjs";
import { fetchCalBookingByUid } from "../services/calBookingFetch.mjs";
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

/** Always allow the deployed app origin so embeds/iframes hosted on the same app URL keep working when marketers set a partial allowedOrigins list. */
function appOriginLower() {
  try {
    const u = new URL(env.appUrl);
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function originAllowed(req, allowedList) {
  if (!allowedList || allowedList.length === 0) return true;
  const appO = appOriginLower();
  const merged = appO && !allowedList.includes(appO) ? [...allowedList, appO] : [...allowedList];
  const origin = req.get("origin")?.toLowerCase() || "";
  const referer = req.get("referer") || "";
  let refOrigin = "";
  try {
    if (referer) refOrigin = new URL(referer).origin.toLowerCase();
  } catch {
    /* ignore */
  }
  const candidates = [origin, refOrigin].filter(Boolean);
  // When an allowlist is configured, deny requests with neither Origin nor Referer (curl/scripts) — the admin opted in to host-based restriction and a missing-header bypass would silently break that control.
  if (candidates.length === 0) return false;
  return candidates.some((c) => merged.includes(c));
}

function readCalIntegration(settings) {
  return settings?.calIntegration === true || settings?.calIntegration === "true";
}

function readCalDiscoveryFieldKey(settings) {
  const k = settings?.calDiscoveryFieldKey;
  return typeof k === "string" && k.trim() ? k.trim() : "discovery_call";
}

function readCalDiscoveryYesValues(settings) {
  const raw = settings?.calDiscoveryYesValues;
  if (Array.isArray(raw) && raw.length) return raw.map((x) => String(x));
  return ["Yes", "yes", "YES"];
}

/** When true, visitor must complete Cal (or explicitly skip) before submit. */
function wantsCalScheduling(form, settings, answers) {
  if (!readCalIntegration(settings)) return false;
  const key = readCalDiscoveryFieldKey(settings);
  const hasDiscoveryField = form.fields.some((f) => f.key === key);
  if (!hasDiscoveryField) return true;
  const raw = answers?.[key];
  const val = raw == null ? "" : String(raw).trim();
  if (!val) return false;
  return readCalDiscoveryYesValues(settings).includes(val);
}

function extractCalLinkFromEmbedUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(withProto);
    const path = u.pathname.replace(/^\/+|\/+$/g, "");
    return path && path.length ? path : null;
  } catch {
    const noProto = s.replace(/^https?:\/\//i, "").split("?")[0]?.replace(/^\/*/, "") ?? "";
    return noProto || null;
  }
}

/**
 * Friendly redirect: someone navigated directly to /api/forms/{embedKey} (or with a trailing
 * slash) — likely from a stale bookmark or by clicking the displayed submit URL in the admin
 * embed panel. Send them to the real public embed page instead of Express's "Cannot GET" page.
 */
router.get("/:embedKey", (req, res) => {
  const appUrl = String(env.appUrl || "").replace(/\/$/, "");
  const target = `${appUrl}/embed/form/${encodeURIComponent(req.params.embedKey)}`;
  return res.redirect(302, target);
});

router.get("/:embedKey/", (req, res) => {
  const appUrl = String(env.appUrl || "").replace(/\/$/, "");
  const target = `${appUrl}/embed/form/${encodeURIComponent(req.params.embedKey)}`;
  return res.redirect(302, target);
});

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
  const calEmbedUrl = settings.calEmbedUrl != null ? String(settings.calEmbedUrl) : "";
  const calLink = extractCalLinkFromEmbedUrl(calEmbedUrl);
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
      calEmbedUrl: calEmbedUrl || null,
      calLink,
      calIntegration,
      calDiscoveryFieldKey: readCalDiscoveryFieldKey(settings),
      calDiscoveryYesValues: readCalDiscoveryYesValues(settings),
      brandLogoText: typeof settings.brandLogoText === "string" ? settings.brandLogoText : null,
      footerAttribution:
        typeof settings.footerAttribution === "string" ? settings.footerAttribution : "Powered by Sitropix",
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

  const { values, issues } = validateFormAnswers(form.fields, body.answers);
  if (issues.length > 0) {
    return res.status(400).json({
      error: "validation_error",
      message: "Please correct the highlighted fields and try again.",
      issues,
    });
  }

  const sanitized = sanitizePayloadValues(values);

  const hasBooking = Boolean(body.calBookingId?.trim());
  let meetingUrl = body.meetingUrl?.trim() || null;
  if (meetingUrl && !isAllowedPublicMeetingUrl(meetingUrl, { hasCalBookingId: hasBooking })) {
    return res.status(400).json({
      error: "invalid_meeting_url",
      message: "Meeting URL must be HTTPS and an allowed host (Cal.com or common video links when booking id is present).",
    });
  }

  let calMeetingDetailsJson = null;
  let meetingScheduledAt = null;
  const bookingUid = body.calBookingId?.trim() || null;
  if (bookingUid && env.calApiKey) {
    const fetched = await fetchCalBookingByUid(bookingUid);
    if (fetched.ok && fetched.body != null) {
      calMeetingDetailsJson = fetched.body;
      if (fetched.meetingUrl && isAllowedPublicMeetingUrl(fetched.meetingUrl, { hasCalBookingId: true })) {
        meetingUrl = meetingUrl || fetched.meetingUrl;
      }
      if (fetched.startTime) {
        const d = new Date(fetched.startTime);
        if (!Number.isNaN(d.getTime())) meetingScheduledAt = d;
      }
    }
  }

  const hasMeeting = Boolean(
    hasBooking ||
      (meetingUrl && isAllowedPublicMeetingUrl(meetingUrl, { hasCalBookingId: hasBooking })),
  );
  const mustSchedule = wantsCalScheduling(form, settings, sanitized);
  if (mustSchedule && !hasMeeting && !body.schedulingSkipped) {
    return res.status(400).json({
      error: "scheduling_required_or_skip",
      message: "Complete Cal scheduling or set schedulingSkipped: true in the submit payload.",
    });
  }

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
          calBookingId: bookingUid || null,
          meetingUrlAtSubmit: meetingUrl,
          calMeetingDetailsJson: calMeetingDetailsJson ?? undefined,
        },
      });

      const leadMeetingAt = hasMeeting ? meetingScheduledAt ?? new Date() : null;

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
          meetingScheduledAt: leadMeetingAt,
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
