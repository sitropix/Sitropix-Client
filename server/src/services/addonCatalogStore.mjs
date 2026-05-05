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
