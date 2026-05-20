import {
  addonPlanPricingMode,
  addonTopLevelCycleCents,
  plansForAddonCatalogPricing,
  readPlanPricingMap,
  resolveAddonPlanPriceCents,
} from "@/lib/addonPlanPricing";
import { isCreditPackAddon } from "@/constants/extraEditAddons";
import type { BillingCycle, Plan, SubscriptionAddon } from "@/types/subscription";
import type { ProjectAddonCard } from "@/types/project";

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
    const scopedPlans = plansForAddonCatalogPricing(plans, addon);
    const prices = scopedPlans
      .map((p) => resolveAddonPlanPriceCents(addon, p, billingCycle))
      .filter((c) => c > 0);
    if (prices.length > 0) return Math.min(...prices);
  }

  const mode = addonPlanPricingMode(addon);
  if (mode === "one_time" || addonIsOneTimeStyle(addon)) {
    return resolveAddonPlanPriceCents(addon, null, null);
  }

  return addonTopLevelCycleCents(addon, billingCycle);
}

/** Customer-facing add-on description aligned with the selected billing cycle. */
export function addonCatalogDisplayDesc(
  addon: SubscriptionAddon,
  billingCycle: BillingCycle,
  plans: Plan[],
) {
  const setup = addon.setupFeeCents ?? 0;
  if (addon.billingKind === "recurring" && setup > 0) {
    const recurring = addonCatalogDisplayCents(addon, billingCycle, plans);
    const unit = Math.max(0, recurring - setup);
    const unitLabel = formatAddonMoney(unit, addon.currency || "USD");
    const setupLabel = formatAddonMoney(setup, addon.currency || "USD");
    const cycle = billingCycle === "yearly" ? "yr" : "mo";
    return `${setupLabel} setup + ${unitLabel}/${cycle} recurring.`;
  }
  if (billingCycle !== "yearly") return addon.desc;
  return addon.desc
    .replace(/\$([\d,.]+)\s*\/\s*mo\b/gi, (_, amt) => `$${amt}/yr`)
    .replace(/\bper month\b/gi, "per year")
    .replace(/\bmonthly\b/gi, "yearly");
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
  plans: Plan[],
  projectPlanId: string | null | undefined,
  billingCycle: BillingCycle = "monthly",
) {
  const plan = plans.find((p) => p.id === projectPlanId) ?? null;
  if (addon.code === "addon_extra_edit_single" || addon.code === "addon_extra_edit_bundle") {
    return resolveExtraEditAddonDisplayCents(addon, plans, projectPlanId);
  }
  return addonCheckoutDisplayCents(addon, plan, billingCycle);
}

/** Resolved display price for a server-built project add-on card. */
export function projectAddonCardPriceCents(
  card: ProjectAddonCard,
  addon: SubscriptionAddon | undefined,
  plan: Plan | null | undefined,
  chosenCycle: BillingCycle,
) {
  if (card.canChooseRecurringCycle && card.recurringPriceOptions) {
    const opts = card.recurringPriceOptions;
    if (chosenCycle === "yearly" && (opts.yearlyPriceCents ?? 0) > 0) {
      return opts.yearlyPriceCents!;
    }
    if (chosenCycle === "monthly" && (opts.monthlyPriceCents ?? 0) > 0) {
      return opts.monthlyPriceCents!;
    }
  }
  if (addon) {
    return addonCheckoutDisplayCents(addon, plan, chosenCycle);
  }
  return card.displayPriceCents;
}

export function projectAddonPriceSuffix(
  addon: SubscriptionAddon | undefined,
  chosenCycle: BillingCycle,
): string | null {
  if (!addon) return chosenCycle === "yearly" ? "/yr" : "/mo";
  const suffix = addonPriceCycleSuffix(addon, chosenCycle);
  return suffix === "one-time" ? null : suffix;
}

export function defaultAddonRecurringCycle(
  subscriptionBillingCycle: BillingCycle | null | undefined,
  cards: ProjectAddonCard[],
): BillingCycle {
  const canChoose = cards.some((c) => c.canChooseRecurringCycle);
  if (subscriptionBillingCycle === "yearly" && canChoose) {
    const def = cards.find((c) => c.defaultRecurringCycle)?.defaultRecurringCycle;
    return def === "yearly" || def === "monthly" ? def : "monthly";
  }
  return subscriptionBillingCycle === "yearly" ? "yearly" : "monthly";
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

/** Can be purchased via POST /addon-checkout-session on an active project subscription. */
export function isAddonCheckoutEligible(addon: SubscriptionAddon): boolean {
  if (addon.billingKind === "per_use") return false;
  if (isCreditPackAddon(addon)) return false;
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
