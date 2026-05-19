import type { Plan, SubscriptionAddon } from "@/types/subscription";

export type AddonPlanPriceEntry = {
  /** One-time price or default when cycle-specific prices are not set */
  priceCents?: number;
  monthlyCents?: number;
  yearlyCents?: number;
  creditsGranted?: number;
};

export type AddonPlanPricing = Record<string, AddonPlanPriceEntry>;

/** @deprecated Use AddonPlanPricing */
export type ExtraEditPlanPricing = AddonPlanPricing;

/** @deprecated Use AddonPlanPriceEntry */
export type ExtraEditPlanPriceEntry = AddonPlanPriceEntry;

export function readExtraEditTier(
  catalogJson: Record<string, unknown> | undefined | null,
): "single" | "bundle" | null {
  const j = catalogJson ?? {};
  const t = j.extraEditTier ?? j.extra_edit_tier;
  if (t === "single" || t === "bundle") return t;
  return null;
}

function parseCents(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.max(0, Math.floor(value));
    return n > 0 ? n : undefined;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = parseInt(value, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function parseEntry(raw: unknown): AddonPlanPriceEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  const priceCents = parseCents(e.priceCents ?? e.price_cents);
  const monthlyCents = parseCents(e.monthlyCents ?? e.monthly_cents);
  const yearlyCents = parseCents(e.yearlyCents ?? e.yearly_cents);
  const creditsGranted = parseCents(e.creditsGranted ?? e.credits_granted);
  if (!priceCents && !monthlyCents && !yearlyCents) return null;
  return {
    ...(priceCents != null ? { priceCents } : {}),
    ...(monthlyCents != null ? { monthlyCents } : {}),
    ...(yearlyCents != null ? { yearlyCents } : {}),
    ...(creditsGranted != null ? { creditsGranted } : {}),
  };
}

export function readPlanPricingMap(
  catalogJson: Record<string, unknown> | undefined | null,
): AddonPlanPricing {
  const raw = catalogJson?.planPricing ?? catalogJson?.plan_pricing;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: AddonPlanPricing = {};
  for (const [code, entry] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = parseEntry(entry);
    if (parsed) out[code] = parsed;
  }
  return out;
}

function readCatalogCreditsGranted(catalogJson: Record<string, unknown> | undefined | null): number {
  const j = catalogJson ?? {};
  const n = j.creditsGranted ?? j.credits_granted;
  const num = typeof n === "number" ? n : parseInt(String(n ?? "0"), 10);
  return Math.max(0, Math.floor(num || 0));
}

export function resolveAddonPlanPriceCents(
  addon: Pick<SubscriptionAddon, "code" | "priceCents" | "catalogJson">,
  plan: Plan | null | undefined,
  billingCycle: "monthly" | "yearly" | null | undefined,
): number {
  const tier = readExtraEditTier(addon.catalogJson);
  if (tier) return readExtraEditAddonOffer(addon, plan).priceCents;

  const entry = plan?.code ? readPlanPricingMap(addon.catalogJson)[plan.code] : undefined;
  if (entry) {
    if (billingCycle === "yearly" && entry.yearlyCents != null && entry.yearlyCents > 0) {
      return entry.yearlyCents;
    }
    if (entry.monthlyCents != null && entry.monthlyCents > 0) {
      return entry.monthlyCents;
    }
    if (entry.priceCents != null && entry.priceCents > 0) {
      return entry.priceCents;
    }
  }
  return Math.max(0, addon.priceCents ?? 0);
}

/** Resolved price and credits for an extra-edit add-on on a given plan. */
export function readExtraEditAddonOffer(
  addon: Pick<SubscriptionAddon, "code" | "priceCents" | "catalogJson">,
  plan: Plan | null | undefined,
): { priceCents: number; creditsGranted: number } {
  const tier = readExtraEditTier(addon.catalogJson);
  const planCode = plan?.code;
  const mapped = planCode ? readPlanPricingMap(addon.catalogJson)[planCode] : undefined;

  if (mapped) {
    const price =
      mapped.priceCents ??
      mapped.monthlyCents ??
      mapped.yearlyCents ??
      0;
    if (price > 0) {
      const creditsGranted =
        tier === "bundle"
          ? Math.max(0, mapped.creditsGranted ?? readCatalogCreditsGranted(addon.catalogJson))
          : 1;
      return { priceCents: price, creditsGranted };
    }
  }

  const basePrice = Math.max(0, addon.priceCents ?? 0);
  if (tier === "single" && basePrice > 0) {
    return { priceCents: basePrice, creditsGranted: 1 };
  }
  if (tier === "bundle" && basePrice > 0) {
    const cg = readCatalogCreditsGranted(addon.catalogJson);
    if (cg > 0) return { priceCents: basePrice, creditsGranted: cg };
  }

  return { priceCents: 0, creditsGranted: 0 };
}

export type AddonPlanPricingRow = {
  planCode: string;
  planName: string;
  priceUsd: string;
  monthlyUsd: string;
  yearlyUsd: string;
  credits: string;
};

export function addonUsesPlanWisePricing(
  addon: Pick<
    SubscriptionAddon,
    "code" | "catalogJson" | "eligiblePlanCodes" | "priceMinCents" | "priceMaxCents"
  >,
): boolean {
  if (readExtraEditTier(addon.catalogJson)) return true;
  if (addon.code === "addon_extra_edit_single" || addon.code === "addon_extra_edit_bundle") {
    return true;
  }
  const eligible = addon.eligiblePlanCodes;
  if (Array.isArray(eligible) && eligible.length > 0) return true;
  if (Object.keys(readPlanPricingMap(addon.catalogJson)).length > 0) return true;
  if (addon.priceMinCents != null || addon.priceMaxCents != null) return true;
  return false;
}

/** Extra-edit packs use a single price column; recurring tiered add-ons use monthly + yearly. */
export function addonPlanPricingMode(
  addon: Pick<SubscriptionAddon, "catalogJson" | "billingKind" | "billingMonthlyEnabled" | "billingYearlyEnabled">,
): "one_time" | "recurring" {
  if (readExtraEditTier(addon.catalogJson)) return "one_time";
  if (addon.billingKind === "one_time") return "one_time";
  if (addon.billingMonthlyEnabled === false && addon.billingYearlyEnabled === false) {
    return "one_time";
  }
  return "recurring";
}

export function pricingRowsFromMap(
  plans: Plan[],
  pricing: AddonPlanPricing,
  options: { showCredits: boolean; mode: "one_time" | "recurring" },
): AddonPlanPricingRow[] {
  return plans.map((p) => {
    const entry = pricing[p.code];
    return {
      planCode: p.code,
      planName: p.name,
      priceUsd: entry?.priceCents != null ? (entry.priceCents / 100).toFixed(2) : "",
      monthlyUsd: entry?.monthlyCents != null ? (entry.monthlyCents / 100).toFixed(2) : "",
      yearlyUsd: entry?.yearlyCents != null ? (entry.yearlyCents / 100).toFixed(2) : "",
      credits:
        options.showCredits && entry?.creditsGranted != null
          ? String(entry.creditsGranted)
          : options.showCredits
            ? ""
            : "1",
    };
  });
}

export function seedPlanPricingFromAddon(
  addon: SubscriptionAddon,
  plans: Plan[],
): AddonPlanPricing {
  const existing = readPlanPricingMap(addon.catalogJson);
  if (Object.keys(existing).length > 0) return existing;

  const eligible = Array.isArray(addon.eligiblePlanCodes)
    ? addon.eligiblePlanCodes.filter((c) => typeof c === "string" && c.trim())
    : [];
  const planCodes =
    eligible.length > 0
      ? eligible
      : plans.filter((p) => p.isActive !== false).map((p) => p.code);

  const mode = addonPlanPricingMode(addon);
  const base = Math.max(0, addon.priceCents ?? 0);
  const min = addon.priceMinCents ?? base;
  const max = addon.priceMaxCents ?? base;
  const out: AddonPlanPricing = {};

  for (const code of planCodes) {
    if (mode === "recurring") {
      out[code] = {
        monthlyCents: min > 0 ? min : base,
        yearlyCents: max > 0 ? max : base,
      };
    } else {
      out[code] = { priceCents: base > 0 ? base : min > 0 ? min : max };
    }
  }
  return out;
}

export function planPricingFromRows(
  rows: AddonPlanPricingRow[],
  options: { showCredits: boolean; mode: "one_time" | "recurring" },
): AddonPlanPricing {
  const out: AddonPlanPricing = {};
  for (const row of rows) {
    const code = row.planCode.trim();
    if (!code) continue;

    if (options.mode === "recurring") {
      const monthly = parseFloat(row.monthlyUsd.replace(/,/g, ""));
      const yearly = parseFloat(row.yearlyUsd.replace(/,/g, ""));
      const entry: AddonPlanPriceEntry = {};
      if (Number.isFinite(monthly) && monthly > 0) entry.monthlyCents = Math.round(monthly * 100);
      if (Number.isFinite(yearly) && yearly > 0) entry.yearlyCents = Math.round(yearly * 100);
      if (entry.monthlyCents || entry.yearlyCents) out[code] = entry;
      continue;
    }

    const price = parseFloat(row.priceUsd.replace(/,/g, ""));
    if (!Number.isFinite(price) || price <= 0) continue;
    const entry: AddonPlanPriceEntry = { priceCents: Math.round(price * 100) };
    if (options.showCredits) {
      const credits = parseInt(row.credits, 10);
      if (Number.isFinite(credits) && credits > 0) entry.creditsGranted = credits;
    }
    out[code] = entry;
  }
  return out;
}

export function firstPlanPriceCents(pricing: AddonPlanPricing): number | undefined {
  const first = Object.values(pricing)[0];
  if (!first) return undefined;
  return first.priceCents ?? first.monthlyCents ?? first.yearlyCents;
}
