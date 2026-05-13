import { looseObject, z } from "zod";

export const CRM_STATUSES = ["NEW", "MEETING_SCHEDULED", "YET_TO_CONTACT", "CONTACTED", "HOLD"];

const fieldTypeSchema = z.enum([
  "text",
  "email",
  "tel",
  "phone",
  "textarea",
  "select",
  "number",
  "url",
  "checkbox",
  "date",
  "hidden",
  "file",
]);

/** `looseObject` allows unknown keys on input/output (admin-only); routes still pick only known props for Prisma. Avoids Zod strict `unrecognized_keys` when clients send extended field metadata. */
export const formFieldInputSchema = looseObject({
  key: z.string().min(1).max(80).regex(/^[a-z][a-z0-9_]*$/i, "Field key must be alphanumeric"),
  label: z.string().min(1).max(200),
  type: fieldTypeSchema,
  required: z.boolean().optional().default(false),
  fieldOrder: z.number().int().min(0).optional(),
  optionsJson: z
    .preprocess(
      (val) => {
        if (!Array.isArray(val)) return [];
        return val
          .map((x) => (x == null ? "" : String(x).trim()))
          .filter((s) => s.length > 0);
      },
      z.array(z.string().min(1)),
    )
    .optional()
    .default([]),
  validationJson: z.record(z.string(), z.unknown()).optional().default({}),
});

export const createFormSchema = looseObject({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers, hyphens"),
  isActive: z.boolean().optional().default(true),
  settingsJson: z.record(z.string(), z.unknown()).optional().default({}),
  fields: z.array(formFieldInputSchema).min(1),
});

export const patchFormSchema = looseObject({
  name: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  isActive: z.boolean().optional(),
  settingsJson: z.record(z.string(), z.unknown()).optional(),
});

export const replaceFormFieldsSchema = looseObject({
  fields: z.array(formFieldInputSchema).min(1),
});

export const publicSubmitSchema = z.object({
  /** JWT from GET .../config — required unless FORM_PUBLIC_CSRF_DISABLED=true */
  csrfToken: z.string().min(10).optional(),
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  sourceUrl: z.string().url().optional().nullable(),
  sourceReferrer: z.string().optional().nullable(),
  utmJson: z.record(z.string(), z.string()).optional().default({}),
  calBookingId: z.string().max(200).optional().nullable(),
  meetingUrl: z.string().max(2048).optional().nullable(),
  /** When calIntegration is on: set true if visitor skipped scheduling (no meeting). */
  schedulingSkipped: z.boolean().optional(),
  /** Client clock; stored only in utmJson-style audit if needed — server sets authoritative submittedAt. */
  submittedAt: z.string().datetime({ offset: true }).optional(),
});

export const patchLeadStatusSchema = z.object({
  toStatus: z.enum(["NEW", "MEETING_SCHEDULED", "YET_TO_CONTACT", "CONTACTED", "HOLD"]),
  meetingLink: z.string().url().max(2048).optional().nullable(),
  reason: z.string().max(2000).optional().nullable(),
});

export const convertLeadSchema = z.object({
  /** If true and email not registered, still create user (default true) */
  createUserIfNeeded: z.boolean().optional().default(true),
});
