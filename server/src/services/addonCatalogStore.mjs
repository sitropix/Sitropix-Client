import { prisma } from "../db/client.mjs";
import { isCreditPackAddon } from "./projectAccessibleAddons.mjs";

function mapAddon(row) {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    desc: row.desc ?? "",
    priceCents: row.priceCents,
    currency: row.currency,
    isActive: row.isActive,
    billingMonthlyEnabled: row.billingMonthlyEnabled ?? true,
    billingYearlyEnabled: row.billingYearlyEnabled ?? true,
    billingKind: row.billingKind ?? "recurring",
    priceMinCents: row.priceMinCents ?? null,
    priceMaxCents: row.priceMaxCents ?? null,
    setupFeeCents: row.setupFeeCents ?? 0,
    deliveryMode: row.deliveryMode ?? "",
    eligiblePlanCodes: Array.isArray(row.eligiblePlanCodes) ? row.eligiblePlanCodes : [],
    catalogJson: row.catalogJson && typeof row.catalogJson === "object" ? row.catalogJson : {},
  };
}

/** Slim add-on row for customer portal / subscription UI (catalogJson only for credit-pack SKUs). */
export function mapAddonForPortal(row) {
  const mapped = {
    code: row.code,
    label: row.label,
    desc: row.desc ?? "",
    priceCents: row.priceCents,
    currency: row.currency,
    isActive: row.isActive,
    billingMonthlyEnabled: row.billingMonthlyEnabled ?? true,
    billingYearlyEnabled: row.billingYearlyEnabled ?? true,
    billingKind: row.billingKind ?? "recurring",
    setupFeeCents: row.setupFeeCents ?? 0,
    eligiblePlanCodes: Array.isArray(row.eligiblePlanCodes) ? row.eligiblePlanCodes : [],
  };
  if (isCreditPackAddon(row)) {
    mapped.catalogJson =
      row.catalogJson && typeof row.catalogJson === "object" ? row.catalogJson : {};
  }
  return mapped;
}

const LEGACY_EXTRA_EDIT_PACK_CODE = "addon_extra_edit_credit_pack";

export async function fetchSubscriptionAddonCatalog() {
  const rows = await prisma.subscriptionAddon.findMany({
    where: { isActive: true, code: { not: LEGACY_EXTRA_EDIT_PACK_CODE } },
    orderBy: [{ priceCents: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(mapAddon);
}

export async function fetchPortalAddonCatalog() {
  const rows = await prisma.subscriptionAddon.findMany({
    where: { isActive: true, code: { not: LEGACY_EXTRA_EDIT_PACK_CODE } },
    orderBy: [{ priceCents: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(mapAddonForPortal);
}

export async function fetchAllSubscriptionAddons() {
  const rows = await prisma.subscriptionAddon.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapAddon);
}
