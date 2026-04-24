import { z } from "zod";

export const changePlanSchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
});

export const paymentMethodSchema = z.object({
  brand: z.string().min(2).max(40),
  last4: z.string().regex(/^\d{4}$/),
  expMonth: z.number().min(1).max(12),
  expYear: z.number().min(new Date().getUTCFullYear()),
});

export const planSchema = z.object({
  code: z.string().min(2).max(60),
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  priceMonthlyCents: z.number().nonnegative(),
  priceYearlyCents: z.number().nonnegative(),
  currency: z.string().min(3).max(3).optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  trialDays: z.number().int().nonnegative().optional(),
});

export const planPatchSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(2000).optional(),
    priceMonthlyCents: z.number().nonnegative().optional(),
    priceYearlyCents: z.number().nonnegative().optional(),
    currency: z.string().min(3).max(3).optional(),
    features: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
    trialDays: z.number().int().nonnegative().optional(),
  })
  .strict();

export const couponSchema = z.object({
  code: z.string().min(3).max(40),
  discountType: z.enum(["percent", "flat"]),
  discountValue: z.number().positive(),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});
