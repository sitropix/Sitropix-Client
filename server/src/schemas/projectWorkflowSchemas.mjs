import { z } from "zod";

const URL_SCHEMA = z
  .string()
  .url()
  .max(2048)
  .refine((u) => /^https?:\/\//i.test(u), { message: "must be http(s)" });

export const workflowStatusSchema = z.enum([
  "awaiting_brief",
  "awaiting_assets",
  "ready_to_start",
  "in_progress",
  "awaiting_customer_reply",
  "in_review",
  "revisions_requested",
  "approved",
  "live",
  "on_hold",
]);

export const updateWorkflowSchema = z
  .object({
    workflowStatus: workflowStatusSchema.optional(),
    phaseProgressPercent: z.number().int().min(0).max(100).optional(),
    reason: z.string().max(500).optional(),
  })
  .strict()
  .refine((b) => b.workflowStatus !== undefined || b.phaseProgressPercent !== undefined, {
    message: "at_least_one_field",
  });

export const projectChatPostSchema = z
  .object({
    body: z.string().trim().min(1).max(8000),
    markWaitingForCustomerReply: z.boolean().optional(),
  })
  .strict();

export const projectSettingsPatchSchema = z
  .object({
    brandVoiceShort: z.string().max(800).optional(),
    notifyOnDesignerReply: z.boolean().optional(),
    notifyOnPhaseChange: z.boolean().optional(),
  })
  .strict()
  .refine(
    (b) =>
      b.brandVoiceShort !== undefined ||
      b.notifyOnDesignerReply !== undefined ||
      b.notifyOnPhaseChange !== undefined,
    { message: "at_least_one_field" },
  );

export const projectUrlsPatchSchema = z
  .object({
    stagingUrl: z.union([URL_SCHEMA, z.literal("")]).optional(),
    liveUrl: z.union([URL_SCHEMA, z.literal("")]).optional(),
  })
  .strict()
  .refine((b) => b.stagingUrl !== undefined || b.liveUrl !== undefined, {
    message: "at_least_one_field",
  });

export const projectApprovalSchema = z
  .object({
    kind: z.enum(["design", "launch"]),
    note: z.string().max(500).optional(),
  })
  .strict();

export const projectAssignSchema = z
  .object({
    designerUserId: z.string().min(1).nullable(),
  })
  .strict();

export const projectShareLinkSchema = z
  .object({
    expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
  })
  .strict();

export const projectPendingCheckoutSchema = z
  .object({
    sessionId: z.string().min(1).max(200),
  })
  .strict();

export const chatMarkReadSchema = z
  .object({
    upToMessageId: z.string().min(1).optional(),
  })
  .strict();
