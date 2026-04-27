import { z } from "zod";

export const createTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(50000),
  departmentId: z.string().max(120).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

export const replyTicketSchema = z.object({
  body: z.string().min(1).max(10000),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]),
});
