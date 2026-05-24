import { z } from "zod";

export const systemConfigPutSchema = z
  .object({
    items: z.array(
      z.object({
        key: z.enum([
          "DATABASE_URL",
          "STRIPE_SECRET_KEY",
        ]),
        value: z.string().max(5000),
        isSecret: z.boolean(),
      }),
    ),
  })
  .strict();

