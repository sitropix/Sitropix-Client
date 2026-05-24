/**
 * Upserts extra-edit add-ons with per-plan pricing on each add-on (`catalogJson.planPricing`).
 * Deactivates the legacy fixed-price pack.
 *
 *   npm run db:sync:extra-edit-addons
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGACY_EXTRA_EDIT_PACK_CODE = "addon_extra_edit_credit_pack";

const planPricedExtraEditAddons = [
  {
    code: "addon_extra_edit_single",
    label: "Extra website edit (single)",
    desc: "Adds 1 purchased edit credit at your plan's per-edit rate.",
    billingKind: "one_time",
    priceCents: 1000,
    priceMinCents: 800,
    priceMaxCents: 1200,
    billingMonthlyEnabled: false,
    billingYearlyEnabled: false,
    deliveryMode: "manual",
    eligiblePlanCodes: ["sitropix_starter", "sitropix_growth", "sitropix_pro"],
    catalogJson: {
      effectKind: "credit_pack",
      extraEditTier: "single",
      planPricing: {
        sitropix_starter: { priceCents: 1200 },
        sitropix_growth: { priceCents: 1000 },
        sitropix_pro: { priceCents: 800 },
      },
    },
  },
  {
    code: "addon_extra_edit_bundle",
    label: "Extra website edit bundle",
    desc: "Adds a bundle of purchased edit credits at your plan's bundle rate.",
    billingKind: "one_time",
    priceCents: 3900,
    priceMinCents: 3900,
    priceMaxCents: 6900,
    billingMonthlyEnabled: false,
    billingYearlyEnabled: false,
    deliveryMode: "manual",
    eligiblePlanCodes: ["sitropix_starter", "sitropix_growth", "sitropix_pro"],
    catalogJson: {
      effectKind: "credit_pack",
      extraEditTier: "bundle",
      planPricing: {
        sitropix_starter: { priceCents: 4900, creditsGranted: 5 },
        sitropix_growth: { priceCents: 3900, creditsGranted: 5 },
        sitropix_pro: { priceCents: 6900, creditsGranted: 10 },
      },
    },
  },
];

async function upsertAddon(a) {
  await prisma.subscriptionAddon.upsert({
    where: { code: a.code },
    create: {
      code: a.code,
      label: a.label,
      desc: a.desc ?? "",
      priceCents: a.priceCents,
      billingKind: a.billingKind,
      priceMinCents: a.priceMinCents ?? null,
      priceMaxCents: a.priceMaxCents ?? null,
      setupFeeCents: 0,
      deliveryMode: a.deliveryMode ?? "",
      eligiblePlanCodes: a.eligiblePlanCodes ?? [],
      catalogJson: a.catalogJson ?? {},
      billingMonthlyEnabled: a.billingMonthlyEnabled ?? true,
      billingYearlyEnabled: a.billingYearlyEnabled ?? true,
      isActive: true,
    },
    update: {
      label: a.label,
      desc: a.desc ?? "",
      priceCents: a.priceCents,
      billingKind: a.billingKind,
      priceMinCents: a.priceMinCents ?? null,
      priceMaxCents: a.priceMaxCents ?? null,
      deliveryMode: a.deliveryMode ?? "",
      eligiblePlanCodes: a.eligiblePlanCodes ?? [],
      catalogJson: a.catalogJson ?? {},
      billingMonthlyEnabled: a.billingMonthlyEnabled ?? true,
      billingYearlyEnabled: a.billingYearlyEnabled ?? true,
      isActive: true,
    },
  });
}

async function main() {
  for (const a of planPricedExtraEditAddons) {
    await upsertAddon(a);
    console.log(`Upserted ${a.code}`);
  }

  const legacy = await prisma.subscriptionAddon.findUnique({
    where: { code: LEGACY_EXTRA_EDIT_PACK_CODE },
  });
  if (legacy?.isActive) {
    await prisma.subscriptionAddon.update({
      where: { code: LEGACY_EXTRA_EDIT_PACK_CODE },
      data: { isActive: false },
    });
    console.log(`Deactivated legacy ${LEGACY_EXTRA_EDIT_PACK_CODE}`);
  } else if (legacy) {
    console.log(`Legacy ${LEGACY_EXTRA_EDIT_PACK_CODE} already inactive`);
  } else {
    console.log(`No legacy ${LEGACY_EXTRA_EDIT_PACK_CODE} row (ok)`);
  }

  console.log("Done. Extra-edit prices are owned by add-on catalog (planPricing).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
