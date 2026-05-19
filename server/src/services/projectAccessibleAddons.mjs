import { isPlanOneTimeOnly } from "./billingProration.mjs";
import { resolveAddonPlanPriceCents, readExtraEditAddonOffer } from "./addonPlanPricing.mjs";
import {
  addonEligibleForPlan,
  isOfficialExtraEditAddonCode,
  EXTRA_EDIT_BUNDLE_CODE,
  EXTRA_EDIT_SINGLE_CODE,
} from "./extraEditCredits.mjs";
import { readAddonEffectKind } from "./subscriptionCredits.mjs";

const LEGACY_EXTRA_EDIT_PACK_CODE = "addon_extra_edit_credit_pack";

export function isCreditPackAddon(addonRow) {
  if (!addonRow?.code) return false;
  if (addonRow.code === LEGACY_EXTRA_EDIT_PACK_CODE) return true;
  if (isOfficialExtraEditAddonCode(addonRow.code)) return true;
  return readAddonEffectKind(addonRow.catalogJson) === "credit_pack";
}

function isAddonOneTimeStyle(row) {
  return row.billingMonthlyEnabled === false && row.billingYearlyEnabled === false;
}

/** Whether an add-on can be billed on the project's subscription cycle. */
export function addonAllowedOnBillingCycle(row, billingCycle, plan) {
  if (!billingCycle) return isAddonOneTimeStyle(row);
  if (plan && isPlanOneTimeOnly(plan)) {
    return isAddonOneTimeStyle(row);
  }
  if (isAddonOneTimeStyle(row)) return true;
  if (row.billingKind === "recurring") {
    if (billingCycle === "yearly") {
      return row.billingMonthlyEnabled !== false || row.billingYearlyEnabled !== false;
    }
    return row.billingMonthlyEnabled !== false;
  }
  if (billingCycle === "yearly") return row.billingYearlyEnabled !== false;
  return row.billingMonthlyEnabled !== false;
}

function recurringPriceOptions(addonRow, plan) {
  if (addonRow.billingKind !== "recurring" || (addonRow.setupFeeCents ?? 0) > 0) {
    return null;
  }
  const monthlyOk = addonRow.billingMonthlyEnabled !== false;
  const yearlyOk = addonRow.billingYearlyEnabled !== false;
  const monthlyPriceCents = monthlyOk
    ? resolveAddonPlanPriceCents(plan, addonRow, "monthly")
    : 0;
  const yearlyPriceCents = yearlyOk
    ? resolveAddonPlanPriceCents(plan, addonRow, "yearly")
    : 0;
  if (monthlyPriceCents <= 0 && yearlyPriceCents <= 0) return null;
  return {
    monthlyPriceCents: monthlyPriceCents > 0 ? monthlyPriceCents : undefined,
    yearlyPriceCents: yearlyPriceCents > 0 ? yearlyPriceCents : undefined,
  };
}

function mapPlanForPricing(planRow) {
  if (!planRow) return null;
  return {
    id: planRow.id,
    code: planRow.code,
    name: planRow.name,
    billingMonthlyEnabled: planRow.billingMonthlyEnabled ?? true,
    billingYearlyEnabled: planRow.billingYearlyEnabled ?? true,
    includedEditCreditsPerPeriod: planRow.includedEditCreditsPerPeriod ?? 0,
    catalogJson:
      planRow.catalogJson && typeof planRow.catalogJson === "object" ? planRow.catalogJson : {},
    priceMonthlyCents: planRow.priceMonthlyCents,
    priceYearlyCents: planRow.priceYearlyCents,
  };
}

function readExtraEditTier(addonRow) {
  const j =
    addonRow?.catalogJson && typeof addonRow.catalogJson === "object" ? addonRow.catalogJson : {};
  const t = j.extraEditTier ?? j.extra_edit_tier;
  if (t === "single" || t === "bundle") return t;
  if (addonRow?.code === EXTRA_EDIT_SINGLE_CODE) return "single";
  if (addonRow?.code === EXTRA_EDIT_BUNDLE_CODE) return "bundle";
  return null;
}

function creditsLabel(plan, addonRow) {
  const offer = readExtraEditAddonOffer(plan, addonRow);
  if (offer.creditsGranted === 1) return "1 credit";
  if (offer.creditsGranted > 1) return `${offer.creditsGranted} credits`;
  return null;
}

function computeDisplayPriceCents(addonRow, plan, billingCycle) {
  const unit = resolveAddonPlanPriceCents(plan, addonRow, billingCycle);
  if (addonRow.billingKind === "recurring" && (addonRow.setupFeeCents ?? 0) > 0) {
    return (addonRow.setupFeeCents ?? 0) + unit;
  }
  return unit > 0 ? unit : addonRow.priceCents ?? 0;
}

function defaultAddonDisplayCycle(subscriptionBillingCycle, addonRow) {
  if (addonRow.billingKind !== "recurring") return subscriptionBillingCycle ?? "monthly";
  if (subscriptionBillingCycle === "yearly") {
    if (addonRow.billingMonthlyEnabled !== false) return "monthly";
    if (addonRow.billingYearlyEnabled !== false) return "yearly";
  }
  return "monthly";
}

function toAddonCard(addonRow, plan, subscriptionBillingCycle) {
  const setup = addonRow.setupFeeCents ?? 0;
  const hasSetupPlusRecurring = addonRow.billingKind === "recurring" && setup > 0;
  const displayCycle = defaultAddonDisplayCycle(subscriptionBillingCycle, addonRow);
  const recurringUnit = hasSetupPlusRecurring
    ? resolveAddonPlanPriceCents(plan, addonRow, displayCycle)
    : undefined;
  const priceOpts = recurringPriceOptions(addonRow, plan);
  const canChooseRecurringCycle =
    subscriptionBillingCycle === "yearly" &&
    addonRow.billingKind === "recurring" &&
    setup <= 0 &&
    priceOpts != null &&
    (priceOpts.monthlyPriceCents ?? 0) > 0 &&
    (priceOpts.yearlyPriceCents ?? 0) > 0;

  let displayPriceCents = computeDisplayPriceCents(addonRow, plan, displayCycle);
  if (priceOpts && !hasSetupPlusRecurring) {
    displayPriceCents =
      displayCycle === "yearly" && priceOpts.yearlyPriceCents
        ? priceOpts.yearlyPriceCents
        : priceOpts.monthlyPriceCents ?? displayPriceCents;
  }

  return {
    code: addonRow.code,
    label: addonRow.label,
    desc: addonRow.desc ?? "",
    currency: addonRow.currency ?? "USD",
    billingKind: addonRow.billingKind ?? "recurring",
    displayPriceCents,
    setupFeeCents: setup,
    ...(recurringUnit != null ? { recurringPriceCents: recurringUnit } : {}),
    ...(creditsLabel(plan, addonRow) ? { creditsLabel: creditsLabel(plan, addonRow) } : {}),
    hasSetupPlusRecurring,
    ...(priceOpts ? { recurringPriceOptions: priceOpts } : {}),
    canChooseRecurringCycle,
    defaultRecurringCycle: displayCycle,
  };
}

/**
 * Plan- and billing-cycle–scoped add-ons for a project (excludes credit-pack SKUs).
 * `existing` = purchased on the project; `purchasable` = eligible and not yet owned.
 */
export function resolveProjectAccessibleAddons({
  catalog,
  plan,
  billingCycle,
  ownedAddonCodes = [],
  periodStartIso = null,
}) {
  const ownedSet = new Set(
    ownedAddonCodes.filter((c) => typeof c === "string" && c.trim()),
  );
  const planObj = mapPlanForPricing(plan);
  const existing = [];
  const purchasable = [];

  for (const row of catalog) {
    if (isCreditPackAddon(row)) continue;

    const owned = ownedSet.has(row.code);
    const planEligible = planObj ? addonEligibleForPlan(row, planObj) : false;
    const cycleEligible = addonAllowedOnBillingCycle(row, billingCycle, planObj);

    if (owned) {
      existing.push(toAddonCard(row, planObj, billingCycle));
      continue;
    }
    if (!planObj || !planEligible || !cycleEligible) continue;
    purchasable.push(toAddonCard(row, planObj, billingCycle));
  }

  const byPrice = (a, b) => a.displayPriceCents - b.displayPriceCents;
  existing.sort(byPrice);
  purchasable.sort(byPrice);

  const subscriptionBillingCycle =
    billingCycle === "yearly" || billingCycle === "monthly" ? billingCycle : "monthly";
  return {
    existing,
    purchasable,
    billingContext: {
      subscriptionBillingCycle,
      periodStartIso,
      canChooseRecurringAddonCycle: subscriptionBillingCycle === "yearly",
      /** Yearly plan + monthly recurring add-on uses a dedicated Stripe subscription. */
      supportsSeparateRecurringAddonSubscription: subscriptionBillingCycle === "yearly",
    },
  };
}

function resolveExtraEditPurchaseAddons(catalog, plan) {
  const planObj = mapPlanForPricing(plan);
  let single;
  let bundle;
  for (const row of catalog) {
    if (!isCreditPackAddon(row) || row.isActive === false) continue;
    if (planObj && !addonEligibleForPlan(row, planObj)) continue;
    if (row.code === EXTRA_EDIT_SINGLE_CODE) single = row;
    if (row.code === EXTRA_EDIT_BUNDLE_CODE) bundle = row;
    const tier = readExtraEditTier(row);
    if (!single && tier === "single") single = row;
    if (!bundle && tier === "bundle") bundle = row;
  }
  return { single, bundle, planObj };
}

export function resolveExtraEditPurchaseSummary(catalog, plan) {
  const { single, bundle, planObj } = resolveExtraEditPurchaseAddons(catalog, plan);
  const currency = single?.currency ?? bundle?.currency ?? "USD";
  const singleOffer = single ? readExtraEditAddonOffer(planObj, single) : { priceCents: 0, creditsGranted: 0 };
  const bundleOffer = bundle ? readExtraEditAddonOffer(planObj, bundle) : { priceCents: 0, creditsGranted: 0 };
  const perEditCents = singleOffer.priceCents;
  const bundleCredits = bundleOffer.creditsGranted;
  const bundleCents = bundleOffer.priceCents;
  const available = perEditCents > 0 || (bundleCredits > 0 && bundleCents > 0);

  if (!available) {
    return { available: false, currency, perEditCents: 0, bundleCredits: 0, bundleCents: 0 };
  }

  return {
    available: true,
    currency,
    perEditCents,
    bundleCredits,
    bundleCents,
    singleAddonCode: single?.code ?? null,
    bundleAddonCode: bundle?.code ?? null,
  };
}
