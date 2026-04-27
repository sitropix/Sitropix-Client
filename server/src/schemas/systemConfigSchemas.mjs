import { z } from "zod";

export const systemConfigPutSchema = z
  .object({
    items: z.array(
      z.object({
        key: z.enum([
          "DATABASE_URL",
          "STRIPE_SECRET_KEY",
          "STRIPE_WEBHOOK_SECRET",
          "STRIPE_SUCCESS_URL",
          "STRIPE_CANCEL_URL",
          "APP_URL",
          "API_URL",
          "EMAIL_PROVIDER",
          "EMAIL_FROM",
          "RESEND_API_KEY",
          "SENDGRID_API_KEY",
          "ALLOWED_REDIRECT_ORIGINS",
        ]),
        value: z.string().max(5000),
        isSecret: z.boolean(),
      }),
    ),
  })
  .strict();

