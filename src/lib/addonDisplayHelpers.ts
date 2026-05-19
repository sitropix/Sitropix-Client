import type { SubscriptionAddon } from "@/types/subscription";

export function formatAddonMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
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
