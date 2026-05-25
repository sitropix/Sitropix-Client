import { z } from "zod";

export const emailSettingsPutSchema = z.object({
  provider: z.enum(["console", "smtp", "brevo", "mailgun", "resend", "sendgrid"]),
  fromEmail: z.string().email(),
  fromName: z.string().max(200).optional(),
  settings: z.record(z.string(), z.any()).optional(),
  secrets: z.record(z.string(), z.string()).optional(),
});

export const emailTestSchema = z.object({
  to: z.string().email().optional(),
});

export const emailTemplatePutSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    subject: z.string().trim().min(1).max(400),
    html: z.string().min(1).max(100_000),
  })
  .strict();
