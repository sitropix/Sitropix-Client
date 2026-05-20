/**
 * Seeds Sitropix plans, add-ons (subscription_addons), and website edit types (edit_types).
 * Intended after `db-flush-billing-core` + `prisma migrate deploy` on an empty catalog.
 *
 *   node scripts/db-seed-catalog.mjs
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const plans = [
  {
    code: "sitropix_starter",
    name: "Starter",
    description: "Brochure site — up to 5 pages, template-based, branded.",
    priceMonthlyCents: 5900,
    priceYearlyCents: 5900 * 10,
    includedEditCreditsPerPeriod: 2,
    catalogJson: {
      setupFeeMinCents: 14900,
      setupFeeMaxCents: 14900,
      onboardingDaysMin: 5,
      onboardingDaysMax: 7,
      websiteType: "Brochure site",
      pagesIncludedMax: 5,
      designLevel: "Template-based, branded",
      mobileResponsive: true,
      customDomainSsl: true,
      ecommerceProductCap: 0,
      liveChatIncluded: false,
      bookingIncluded: false,
      businessEmailInboxes: 0,
      fullSeoSetupOneTime: false,
      googleBusinessProfileOneTime: false,
      monthlySeoReport: false,
      blogCmsAccess: false,
      socialFeedEmbed: false,
      googleShopping: false,
      automatedBackups: true,
      uptimeMonitoring: true,
      cookieGdprBanner: true,
      monthlySecurityScan: false,
      maxPurchasedEditCreditsBalance: 24,
      supportChannel: "email_48h",
      dedicatedAccountContact: false,
    },
  },
  {
    code: "sitropix_growth",
    name: "Growth",
    description: "Advanced business site — up to 10 pages, semi-custom layout.",
    priceMonthlyCents: 10900,
    priceYearlyCents: 10900 * 10,
    includedEditCreditsPerPeriod: 5,
    catalogJson: {
      setupFeeMinCents: 29900,
      setupFeeMaxCents: 29900,
      onboardingDaysMin: 7,
      onboardingDaysMax: 10,
      websiteType: "Advanced business site",
      pagesIncludedMax: 10,
      designLevel: "Semi-custom layout",
      mobileResponsive: true,
      customDomainSsl: true,
      ecommerceProductCap: 0,
      liveChatIncluded: true,
      bookingIncluded: true,
      businessEmailInboxes: 1,
      fullSeoSetupOneTime: true,
      googleBusinessProfileOneTime: true,
      monthlySeoReport: true,
      blogCmsAccess: true,
      socialFeedEmbed: false,
      googleShopping: false,
      automatedBackups: true,
      uptimeMonitoring: true,
      cookieGdprBanner: true,
      monthlySecurityScan: true,
      maxPurchasedEditCreditsBalance: 30,
      supportChannel: "email_chat_24h",
      dedicatedAccountContact: false,
    },
  },
  {
    code: "sitropix_pro",
    name: "Pro",
    description: "Full e-commerce — up to 15 pages + product pages, fully custom.",
    priceMonthlyCents: 19900,
    priceYearlyCents: 19900 * 10,
    includedEditCreditsPerPeriod: 10,
    catalogJson: {
      setupFeeMinCents: 49900,
      setupFeeMaxCents: 79900,
      onboardingDaysMin: 10,
      onboardingDaysMax: 15,
      websiteType: "Full e-commerce store",
      pagesIncludedMax: 15,
      designLevel: "Fully custom, conversion-focused",
      mobileResponsive: true,
      customDomainSsl: true,
      ecommerceProductCap: 50,
      productOverageCentsPerProductPerMonth: 100,
      liveChatIncluded: true,
      bookingIncluded: true,
      businessEmailInboxes: 5,
      fullSeoSetupOneTime: true,
      googleBusinessProfileOneTime: true,
      monthlySeoReport: true,
      blogCmsAccess: true,
      socialFeedEmbed: true,
      googleShopping: true,
      automatedBackups: true,
      uptimeMonitoring: true,
      cookieGdprBanner: true,
      monthlySecurityScan: true,
      maxPurchasedEditCreditsBalance: 55,
      supportChannel: "priority_4h",
      dedicatedAccountContact: true,
    },
  },
];

const addons = [
  {
    code: "addon_google_business_profile",
    label: "Google Business Profile setup",
    desc: "One-time setup (manual delivery).",
    billingKind: "one_time",
    priceCents: 12400,
    priceMinCents: 9900,
    priceMaxCents: 14900,
    deliveryMode: "manual",
    billingMonthlyEnabled: false,
    billingYearlyEnabled: false,
    eligiblePlanCodes: ["sitropix_starter"],
    catalogJson: { effectKind: "consumable_service" },
  },
  {
    code: "addon_full_seo_setup",
    label: "Full SEO setup",
    desc: "One-time (semi-auto).",
    billingKind: "one_time",
    priceCents: 19900,
    priceMinCents: 14900,
    priceMaxCents: 24900,
    deliveryMode: "semi_auto",
    billingMonthlyEnabled: false,
    billingYearlyEnabled: false,
    eligiblePlanCodes: ["sitropix_starter"],
    catalogJson: { effectKind: "consumable_service" },
  },
  {
    code: "addon_email_marketing_setup",
    label: "Email marketing setup",
    desc: "One-time $149 setup (manual).",
    billingKind: "one_time",
    priceCents: 14900,
    deliveryMode: "manual",
    billingMonthlyEnabled: false,
    billingYearlyEnabled: false,
    catalogJson: { effectKind: "consumable_service" },
  },
  {
    code: "addon_ecommerce_bolt_on",
    label: "E-commerce bolt-on (Starter/Growth)",
    desc: "$299 setup + $45/mo recurring.",
    billingKind: "recurring",
    priceCents: 4500,
    setupFeeCents: 29900,
    priceMinCents: 4500,
    priceMaxCents: 45000,
    deliveryMode: "semi_auto",
    eligiblePlanCodes: ["sitropix_starter", "sitropix_growth"],
    catalogJson: { stripeRecurringInterval: "month" },
  },
  {
    code: "addon_extra_email_inbox",
    label: "Additional email inboxes",
    desc: "$5/mo each (semi-auto).",
    billingKind: "recurring",
    priceCents: 500,
    deliveryMode: "semi_auto",
    catalogJson: {},
  },
  {
    code: "addon_monthly_content_updates",
    label: "Monthly content updates (5 edits)",
    desc: "Recurring — manual delivery.",
    billingKind: "recurring",
    priceCents: 7500,
    priceMinCents: 5000,
    priceMaxCents: 10000,
    deliveryMode: "manual",
    catalogJson: {},
  },
  {
    code: "addon_monthly_seo_report",
    label: "Monthly SEO report",
    desc: "Automated report.",
    billingKind: "recurring",
    priceCents: 3750,
    priceMinCents: 2500,
    priceMaxCents: 5000,
    deliveryMode: "automated",
    catalogJson: {},
  },
  {
    code: "addon_ongoing_seo_management",
    label: "Ongoing SEO management",
    desc: "Manual ongoing work.",
    billingKind: "recurring",
    priceCents: 22500,
    priceMinCents: 15000,
    priceMaxCents: 30000,
    deliveryMode: "manual",
    catalogJson: {},
  },
  {
    code: "addon_blog_cms_starter",
    label: "Blog / CMS access (Starter)",
    desc: "Recurring add-on for Starter.",
    billingKind: "recurring",
    priceCents: 2000,
    priceMinCents: 2000,
    priceMaxCents: 20000,
    deliveryMode: "semi_auto",
    eligiblePlanCodes: ["sitropix_starter"],
    catalogJson: {},
  },
  {
    code: "addon_live_chat_starter",
    label: "Live chat widget (Starter)",
    desc: "Automated widget setup.",
    billingKind: "recurring",
    priceCents: 1500,
    priceMinCents: 1500,
    priceMaxCents: 15000,
    deliveryMode: "automated",
    eligiblePlanCodes: ["sitropix_starter"],
    catalogJson: {},
  },
  {
    code: "addon_booking_widget",
    label: "Booking widget (Starter/Growth)",
    desc: "Automated.",
    billingKind: "recurring",
    priceCents: 1200,
    priceMinCents: 1200,
    priceMaxCents: 12000,
    deliveryMode: "automated",
    eligiblePlanCodes: ["sitropix_starter", "sitropix_growth"],
    catalogJson: {},
  },
  {
    code: "addon_social_feed_embed",
    label: "Social media feed embed",
    desc: "Automated embed.",
    billingKind: "recurring",
    priceCents: 1000,
    deliveryMode: "automated",
    catalogJson: {},
  },
  {
    code: "addon_analytics_dashboard",
    label: "Analytics dashboard",
    desc: "Automated dashboard.",
    billingKind: "recurring",
    priceCents: 2000,
    priceMinCents: 1500,
    priceMaxCents: 2500,
    deliveryMode: "automated",
    catalogJson: {},
  },
  {
    code: "addon_photography_stock",
    label: "Photography / stock images",
    desc: "One-time manual.",
    billingKind: "one_time",
    priceCents: 7400,
    priceMinCents: 4900,
    priceMaxCents: 9900,
    deliveryMode: "manual",
    billingMonthlyEnabled: false,
    billingYearlyEnabled: false,
    catalogJson: { effectKind: "consumable_service" },
  },
  {
    code: "addon_product_catalog_management",
    label: "Product catalog management",
    desc: "Recurring manual.",
    billingKind: "recurring",
    priceCents: 4250,
    priceMinCents: 3500,
    priceMaxCents: 5000,
    deliveryMode: "manual",
    catalogJson: {},
  },
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
  {
    code: "addon_support_priority_boost",
    label: "Support priority boost",
    desc: "Until this project's next billing date, website edit tickets are queued as high priority.",
    billingKind: "one_time",
    priceCents: 2900,
    priceMinCents: 1900,
    priceMaxCents: 4900,
    billingMonthlyEnabled: false,
    billingYearlyEnabled: false,
    deliveryMode: "manual",
    eligiblePlanCodes: ["sitropix_starter", "sitropix_growth"],
    catalogJson: { effectKind: "priority_boost" },
  },
  {
    code: "addon_rush_edit_surcharge",
    label: "Rush edit surcharge",
    desc: "Per-use — billed as 2× credit cost at fulfillment (placeholder).",
    billingKind: "per_use",
    priceCents: 0,
    billingMonthlyEnabled: false,
    billingYearlyEnabled: false,
    deliveryMode: "manual",
    catalogJson: { effectKind: "per_ticket", creditMultiplier: 2 },
  },
];

const editTypes = [
  { code: "edit_text_single_section", label: "Text change (single section)", category: "atomic", creditsMin: 1, creditsMax: 1, defaultChargeCredits: 1, sortOrder: 10 },
  { code: "edit_image_swap_single", label: "Image swap (single image)", category: "atomic", creditsMin: 1, creditsMax: 1, defaultChargeCredits: 1, sortOrder: 20 },
  { code: "edit_link_url_update", label: "Link / URL update", category: "atomic", creditsMin: 1, creditsMax: 1, defaultChargeCredits: 1, sortOrder: 30 },
  { code: "edit_color_font_single", label: "Color / font change (single element)", category: "atomic", creditsMin: 1, creditsMax: 1, defaultChargeCredits: 1, sortOrder: 40 },
  { code: "edit_menu_item_add_remove", label: "Add / remove a menu item", category: "atomic", creditsMin: 1, creditsMax: 1, defaultChargeCredits: 1, sortOrder: 50 },
  { code: "edit_new_section_existing_page", label: "Add new section to existing page", category: "multi_credit", creditsMin: 3, creditsMax: 3, defaultChargeCredits: 3, sortOrder: 100 },
  { code: "edit_rearrange_page_layout", label: "Rearrange / restructure page layout", category: "multi_credit", creditsMin: 3, creditsMax: 3, defaultChargeCredits: 3, sortOrder: 110 },
  { code: "edit_new_page_content_provided", label: "Add a new page (content provided)", category: "multi_credit", creditsMin: 5, creditsMax: 5, defaultChargeCredits: 5, sortOrder: 120 },
  { code: "edit_new_page_content_not_provided", label: "Add a new page (content NOT provided)", category: "multi_credit", creditsMin: 7, creditsMax: 7, defaultChargeCredits: 7, sortOrder: 130 },
  { code: "edit_form_redesign", label: "Form redesign / new form", category: "multi_credit", creditsMin: 3, creditsMax: 3, defaultChargeCredits: 3, sortOrder: 140 },
  { code: "edit_full_page_redesign", label: "Full page redesign", category: "multi_credit", creditsMin: 8, creditsMax: 10, defaultChargeCredits: 10, sortOrder: 150 },
  { code: "edit_add_ecommerce_product", label: "Add product to e-commerce (per product)", category: "multi_credit", creditsMin: 1, creditsMax: 1, defaultChargeCredits: 1, sortOrder: 160 },
  { code: "edit_batch_product_upload", label: "Batch product upload (10+ products)", category: "multi_credit", creditsMin: 5, creditsMax: 5, defaultChargeCredits: 5, sortOrder: 170 },
];

async function main() {
  const planCount = await prisma.plan.count();
  const addonCount = await prisma.subscriptionAddon.count();
  const editCount = await prisma.editType.count();
  if (planCount > 0 || addonCount > 0 || editCount > 0) {
    console.error(
      "Refusing to seed: plans, subscription_addons, or edit_types already contain rows. Run db-flush-billing-core first (destructive).",
    );
    process.exit(1);
  }

  // Avoid interactive `prisma.$transaction(async tx => …)` here: Prisma Data Platform /
  // pooled servers often return P2028 (transaction timeout / invalid transaction id) on
  // long interactive transactions. Sequential writes are fine for a catalog seed script.
  for (const p of plans) {
    await prisma.plan.create({
      data: {
        code: p.code,
        name: p.name,
        description: p.description,
        priceMonthlyCents: p.priceMonthlyCents,
        priceYearlyCents: p.priceYearlyCents,
        includedEditCreditsPerPeriod: p.includedEditCreditsPerPeriod,
        catalogJson: p.catalogJson,
        features: [
          `${p.includedEditCreditsPerPeriod} website edit credits / billing period`,
          `Up to ${p.catalogJson.pagesIncludedMax} pages`,
        ],
      },
    });
  }

  for (const a of addons) {
    await prisma.subscriptionAddon.create({
      data: {
        code: a.code,
        label: a.label,
        desc: a.desc ?? "",
        priceCents: a.priceCents,
        billingKind: a.billingKind,
        priceMinCents: a.priceMinCents ?? null,
        priceMaxCents: a.priceMaxCents ?? null,
        setupFeeCents: a.setupFeeCents ?? 0,
        deliveryMode: a.deliveryMode ?? "",
        eligiblePlanCodes: a.eligiblePlanCodes ?? [],
        catalogJson: a.catalogJson ?? {},
        billingMonthlyEnabled: a.billingMonthlyEnabled ?? true,
        billingYearlyEnabled: a.billingYearlyEnabled ?? true,
      },
    });
  }

  for (const e of editTypes) {
    await prisma.editType.create({ data: e });
  }

  console.log(`Seeded ${plans.length} plans, ${addons.length} add-ons, ${editTypes.length} edit types.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
