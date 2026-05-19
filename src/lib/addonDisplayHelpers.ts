import {
  addonPlanPricingMode,
  readPlanPricingMap,
  resolveAddonPlanPriceCents,
} from "@/lib/addonPlanPricing";
import type { BillingCycle, Plan, SubscriptionAddon } from "@/types/subscription";

export function formatAddonMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function addonIsOneTimeStyle(addon: SubscriptionAddon) {
  return addon.billingMonthlyEnabled === false && addon.billingYearlyEnabled === false;
}

/** Recurring unit or one-time price for a plan + billing cycle (excludes setup fee). */
export function addonRecurringUnitCents(
  addon: SubscriptionAddon,
  plan: Plan | null | undefined,
  billingCycle: BillingCycle,
) {
  return resolveAddonPlanPriceCents(addon, plan, billingCycle);
}

/** Price shown at checkout / on subscription cards (includes setup + first period when applicable). */
export function addonCheckoutDisplayCents(
  addon: SubscriptionAddon,
  plan: Plan | null | undefined,
  billingCycle: BillingCycle,
) {
  const unit = addonRecurringUnitCents(addon, plan, billingCycle);
  if (addon.billingKind === "recurring" && (addon.setupFeeCents ?? 0) > 0) {
    return (addon.setupFeeCents ?? 0) + unit;
  }
  return unit > 0 ? unit : addon.priceCents ?? 0;
}

/** Catalog reference price when no project plan is selected (lowest active-plan price for the cycle). */
export function addonCatalogDisplayCents(
  addon: SubscriptionAddon,
  billingCycle: BillingCycle,
  plans: Plan[],
) {
  const planMap = readPlanPricingMap(addon.catalogJson);
  if (Object.keys(planMap).length > 0 && plans.length > 0) {
    const prices = plans
      .filter((p) => p.isActive !== false)
      .map((p) => resolveAddonPlanPriceCents(addon, p, billingCycle))
      .filter((c) => c > 0);
    if (prices.length > 0) return Math.min(...prices);
  }

  const mode = addonPlanPricingMode(addon);
  if (mode === "one_time" || addonIsOneTimeStyle(addon)) {
    return resolveAddonPlanPriceCents(addon, null, null);
  }

  if (billingCycle === "yearly" && addon.billingYearlyEnabled !== false) {
    if (addon.priceMaxCents != null && addon.priceMaxCents > 0) return addon.priceMaxCents;
  }
  if (billingCycle === "monthly" && addon.billingMonthlyEnabled !== false) {
    if (addon.priceMinCents != null && addon.priceMinCents > 0) return addon.priceMinCents;
  }
  return addon.priceCents ?? 0;
}

export function addonPriceCycleSuffix(
  addon: SubscriptionAddon,
  billingCycle: BillingCycle,
): string | null {
  if (addonPlanPricingMode(addon) === "one_time" || addonIsOneTimeStyle(addon)) {
    return "one-time";
  }
  if (billingCycle === "yearly" && addon.billingYearlyEnabled !== false) return "/yr";
  if (billingCycle === "monthly" && addon.billingMonthlyEnabled !== false) return "/mo";
  return null;
}

export function resolveExtraEditAddonDisplayCents(
  addon: { code: string; priceCents?: number },
  plans: { id: string; catalogJson?: Record<string, unknown> }[],
  projectPlanId: string | null | undefined,
) {
  if (addon.code !== "addon_extra_edit_single" && addon.code !== "addon_extra_edit_bundle") {
    return addon.priceCents ?? 0;
  }
  const plan = plans.find((p) => p.id === projectPlanId);
  const j = (plan?.catalogJson ?? {}) as Record<string, unknown>;
  if (addon.code === "addon_extra_edit_single") {
    const c = typeof j.extraEditSingleCents === "number" ? j.extraEditSingleCents : 0;
    return Math.max(0, c);
  }
  const c = typeof j.extraEditPackCents === "number" ? j.extraEditPackCents : 0;
  return Math.max(0, c);
}

export function extraEditAddonCaption(
  addon: { code: string },
  plans: { id: string; catalogJson?: Record<string, unknown> }[],
  projectPlanId: string | null | undefined,
) {
  if (addon.code === "addon_extra_edit_single") return "1 credit";
  if (addon.code !== "addon_extra_edit_bundle") return "";
  const plan = plans.find((p) => p.id === projectPlanId);
  const j = (plan?.catalogJson ?? {}) as Record<string, unknown>;
  const n = typeof j.extraEditPackCount === "number" ? j.extraEditPackCount : 0;
  return n > 0 ? `${n} credits` : "";
}

export function addonCardDisplayCents(
  addon: SubscriptionAddon,
  plans: { id: string; catalogJson?: Record<string, unknown> }[],
  projectPlanId: string | null | undefined,
) {
  if (addon.billingKind === "recurring" && (addon.setupFeeCents ?? 0) > 0) {
    return (addon.setupFeeCents ?? 0) + (addon.priceCents ?? 0);
  }
  return resolveExtraEditAddonDisplayCents(addon, plans, projectPlanId);
}

export function addonRecurringMonthlyCents(addon: SubscriptionAddon) {
  return addon.priceCents ?? 0;
}

export function addonCategoryLabel(addon: SubscriptionAddon): string {
  if (addon.billingKind === "per_use") return "Usage-based";
  if (addon.billingKind === "one_time") return "One-time";
  if (addon.billingMonthlyEnabled === false && addon.billingYearlyEnabled === false) {
    return "One-time";
  }
  if (addon.deliveryMode?.trim()) return addon.deliveryMode.trim();
  return addon.billingKind === "recurring" ? "Recurring" : "Add-on";
}

export function isAddonRecurring(addon: SubscriptionAddon): boolean {
  if (addon.billingKind === "one_time" || addon.billingKind === "per_use") return false;
  if (addon.billingMonthlyEnabled === false && addon.billingYearlyEnabled === false) {
    return false;
  }
  return addon.billingKind === "recurring" || addon.billingKind == null;
}

/** Recurring add-on with setup + first period combined in addon checkout (only one per session). */
export function isRecurringSetupAddon(addon: SubscriptionAddon): boolean {
  return addon.billingKind === "recurring" && (addon.setupFeeCents ?? 0) > 0;
}

/** Can be purchased via POST /addon-checkout-session (excludes plain recurring without setup fee). */
export function isAddonCheckoutEligible(addon: SubscriptionAddon): boolean {
  if (addon.billingKind === "recurring" && (addon.setupFeeCents ?? 0) <= 0) {
    return false;
  }
  return true;
}

/** Supports multi-select in cart with other one-time add-ons. */
export function isAddonMultiSelectCart(addon: SubscriptionAddon): boolean {
  return !isRecurringSetupAddon(addon);
}

export function billingCycleLabel(project: { billingCycle?: string | null }) {
  const cycle = project.billingCycle ?? "monthly";
  return cycle === "yearly" ? "Yearly (aligns with base plan)" : "Monthly (aligns with base plan)";
}
