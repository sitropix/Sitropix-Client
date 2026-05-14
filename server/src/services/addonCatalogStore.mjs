import { prisma } from "../db/client.mjs";

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

export async function fetchSubscriptionAddonCatalog() {
  const rows = await prisma.subscriptionAddon.findMany({
    where: { isActive: true },
    orderBy: [{ priceCents: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(mapAddon);
}

export async function fetchAllSubscriptionAddons() {
  const rows = await prisma.subscriptionAddon.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapAddon);
}
