import { z } from "zod";

export const createInviteSchema = z.object({
  email: z.string().email(),
  planId: z.string().min(1).optional(),
  message: z.string().max(4000).optional(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});
