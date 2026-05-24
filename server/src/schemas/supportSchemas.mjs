import { z } from "zod";

export const createTicketSchema = z
  .object({
    subject: z.string().min(3).max(200),
    description: z.string().min(10).max(50000),
    departmentId: z.string().max(120).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    /** general | edit | addon — controls project/add-on requirements. */
    ticketCategory: z.enum(["general", "edit", "addon"]).optional(),
    /** Optional project to associate (must be owned by the authenticated user). */
    projectId: z.string().min(1).max(80).optional(),
    /** When set, this is a billable website edit — requires projectId and an active subscription (enforced server-side). */
    editTypeId: z.string().min(1).max(80).optional(),
    /** Required when ticketCategory is addon. */
    subscriptionAddonId: z.string().min(1).max(80).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const category = val.ticketCategory ?? "general";
    if (val.editTypeId?.trim() && !val.projectId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "project_required_with_edit_type",
        path: ["projectId"],
      });
    }
    if (category === "edit" && !val.projectId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "project_required_for_edit",
        path: ["projectId"],
      });
    }
    if (category === "addon") {
      if (!val.projectId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "project_required_for_addon",
          path: ["projectId"],
        });
      }
      if (!val.subscriptionAddonId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "addon_required",
          path: ["subscriptionAddonId"],
        });
      }
    }
    if (category === "general" && val.subscriptionAddonId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "addon_only_for_addon_category",
        path: ["subscriptionAddonId"],
      });
    }
  });

export const replyTicketSchema = z.object({
  body: z.string().min(1).max(10000),
});

export const updateTicketStatusSchema = z
  .object({
    status: z.enum(["open", "in_progress", "hold", "resolved"]),
    /**
     * When moving to resolved: false = request not completed, refund reserved website-edit credits once.
     * Defaults to true when omitted.
     */
    workCompleted: z.boolean().optional(),
  })
  .strict();
