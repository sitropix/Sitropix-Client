import { z } from "zod";

export const changePlanSchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
  projectId: z.string().min(1).max(120).optional(),
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
  billingMonthlyEnabled: z.boolean().optional(),
  billingYearlyEnabled: z.boolean().optional(),
  includedEditCreditsPerPeriod: z.number().int().nonnegative().optional(),
  catalogJson: z.record(z.string(), z.any()).optional(),
});

export const planCatalogSyncSchema = z
  .object({
    migrateSubscriptions: z.boolean().optional(),
    prorationBehavior: z.enum(["none", "create_prorations", "always_invoice"]).optional(),
  })
  .strict();

export const planPatchSchema = z
  .object({
    description: z.string().max(2000).optional(),
    priceMonthlyCents: z.number().nonnegative().optional(),
    priceYearlyCents: z.number().nonnegative().optional(),
    features: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
    trialDays: z.number().int().nonnegative().optional(),
    billingMonthlyEnabled: z.boolean().optional(),
    billingYearlyEnabled: z.boolean().optional(),
    includedEditCreditsPerPeriod: z.number().int().nonnegative().optional(),
    catalogJson: z.record(z.string(), z.any()).optional(),
    stripeProductId: z.string().max(200).nullable().optional(),
    stripePriceMonthlyId: z.string().max(200).nullable().optional(),
    stripePriceYearlyId: z.string().max(200).nullable().optional(),
    razorpayPlanId: z.string().max(200).nullable().optional(),
  })
  .strict();

export const addonSchema = z.object({
  code: z.string().min(2).max(80),
  label: z.string().min(2).max(120),
  desc: z.string().max(500).optional(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().min(3).max(3).optional(),
  isActive: z.boolean().optional(),
  billingMonthlyEnabled: z.boolean().optional(),
  billingYearlyEnabled: z.boolean().optional(),
  billingKind: z.enum(["recurring", "one_time", "per_use"]).optional(),
  priceMinCents: z.number().int().nonnegative().nullable().optional(),
  priceMaxCents: z.number().int().nonnegative().nullable().optional(),
  setupFeeCents: z.number().int().nonnegative().optional(),
  deliveryMode: z.string().max(40).optional(),
  eligiblePlanCodes: z.array(z.string()).optional(),
  catalogJson: z.record(z.string(), z.any()).optional(),
});

export const addonPatchSchema = z
  .object({
    desc: z.string().max(500).optional(),
    priceCents: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
    billingMonthlyEnabled: z.boolean().optional(),
    billingYearlyEnabled: z.boolean().optional(),
    billingKind: z.enum(["recurring", "one_time", "per_use"]).optional(),
    priceMinCents: z.number().int().nonnegative().nullable().optional(),
    priceMaxCents: z.number().int().nonnegative().nullable().optional(),
    setupFeeCents: z.number().int().nonnegative().optional(),
    deliveryMode: z.string().max(40).optional(),
    eligiblePlanCodes: z.array(z.string()).optional(),
    catalogJson: z.record(z.string(), z.any()).optional(),
  })
  .strict();

export const editTypePatchSchema = z
  .object({
    label: z.string().min(2).max(200).optional(),
    category: z.enum(["atomic", "multi_credit"]).optional(),
    creditsMin: z.number().int().nonnegative().optional(),
    creditsMax: z.number().int().nonnegative().optional(),
    defaultChargeCredits: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();

export const couponSchema = z.object({
  code: z.string().min(3).max(40),
  discountType: z.enum(["percent", "flat"]),
  discountValue: z.number().positive(),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

const cycleSchema = z.enum(["monthly", "yearly"]);
const safeReturnUrlSchema = z.string().url().max(2048);

export const bootstrapSubscriptionSchema = z.object({
  planId: z.string().min(1),
  billingCycle: cycleSchema.optional(),
  projectId: z.string().min(1).max(120),
});

export const checkoutSessionSchema = z.object({
  planId: z.string().min(1),
  billingCycle: cycleSchema.optional(),
  addons: z.array(z.string().min(1)).max(20).optional(),
  projectId: z.string().min(1).max(120),
  successUrl: safeReturnUrlSchema.optional(),
  cancelUrl: safeReturnUrlSchema.optional(),
});

export const extraEditCheckoutSchema = z
  .object({
    mode: z.enum(["per_edit", "bundle"]),
    perEditQuantity: z.number().int().positive().max(500).optional(),
  })
  .strict();

export const addonCheckoutSessionSchema = z.object({
  projectId: z.string().min(1).max(120),
  addonCodes: z.array(z.string().min(1)).min(1).max(20),
  successUrl: safeReturnUrlSchema.optional(),
  cancelUrl: safeReturnUrlSchema.optional(),
  extraEditCheckout: extraEditCheckoutSchema.optional(),
  /** When the project subscription is yearly, choose monthly vs yearly billing for recurring add-ons. */
  addonRecurringCycle: z.enum(["monthly", "yearly"]).optional(),
});

export const confirmAddonCheckoutSchema = z.object({
  sessionId: z.string().min(1).max(200),
  projectId: z.string().min(1).max(120),
});

export const billingPortalSchema = z.object({
  returnUrl: safeReturnUrlSchema.optional(),
  projectId: z.string().min(1).max(120).optional(),
});

export const emptyObjectSchema = z.object({}).strict();

export const subscriptionActionSchema = z.object({
  projectId: z.string().min(1).max(120).optional(),
});

export const projectSubscriptionActionSchema = z.object({
  projectId: z.string().min(1).max(120),
});

export const adminSubscriptionPatchSchema = z
  .object({
    status: z.enum(["trialing", "active", "paused", "canceled", "past_due"]).optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    pausedAt: z.union([z.string().datetime(), z.null()]).optional(),
    canceledAt: z.union([z.string().datetime(), z.null()]).optional(),
    currentPeriodEnd: z.string().datetime().optional(),
    extendDays: z.number().int().positive().max(366).optional(),
  })
  .strict();

const funnelNameEnum = z.enum([
  "subscription_plans_viewed",
  "subscription_plan_cta",
  "subscription_checkout_redirect",
  "subscription_checkout_return",
  "subscription_plan_changed",
  "subscription_bootstrap_trial",
]);

export const funnelEventSchema = z
  .object({
    name: funnelNameEnum,
    properties: z
      .record(z.string(), z.unknown())
      .optional()
      .refine((p) => p == null || JSON.stringify(p).length <= 4000, { message: "properties_too_large" }),
  })
  .strict();

export const adminFeatureFlagPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    stringValue: z.union([z.string().min(1).max(120), z.null()]).optional(),
  })
  .strict()
  .refine((b) => b.enabled !== undefined || b.stringValue !== undefined, {
    message: "at_least_one_field",
  });

export const adminUserRolePatchSchema = z
  .object({
    role: z.enum(["user", "manager", "admin", "master_admin", "support"]),
  })
  .strict();

export const adminUserSetPasswordSchema = z
  .object({
    newPassword: z.string().min(8).max(200),
  })
  .strict();

export const adminUserModuleAccessPutSchema = z
  .object({
    modules: z.array(
      z.object({
        moduleKey: z.string().min(2).max(80),
        enabled: z.boolean(),
      }),
    ),
  })
  .strict();
