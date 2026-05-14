import { z } from "zod";

export const createTicketSchema = z
  .object({
    subject: z.string().min(3).max(200),
    description: z.string().min(10).max(50000),
    departmentId: z.string().max(120).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    /** Optional project to associate (must be owned by the authenticated user). */
    projectId: z.string().min(1).max(80).optional(),
    /** Required when projectId is set — defines credit cost for this website edit request. */
    editTypeId: z.string().min(1).max(80).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.projectId?.trim() && !val.editTypeId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "edit_type_required_with_project",
        path: ["editTypeId"],
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
