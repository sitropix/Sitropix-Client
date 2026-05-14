import { z } from "zod";

const posDollar = z.number().finite().positive();
const posInt = z.number().int().positive();
const nonNegInt = z.number().int().nonnegative();

/** Admin-editable website package fields stored in `plan.catalogJson`. */
export const planWebsiteCatalogSchema = z
  .object({
    listPriceUsd: posDollar,
    oneTimeSetupFeeUsd: posDollar,
    onboardingTurnaround: z.string().min(1).max(240),
    websiteType: z.string().min(1).max(200),
    pagesIncluded: posInt,
    designLevel: z.string().min(1).max(200),
    mobileResponsive: z.boolean(),
    customDomainSsl: z.boolean(),
    productCatalog: z.string().min(1).max(240),
    shoppingCartCheckout: z.boolean(),
    paymentGateway: z.boolean(),
    productCmsAccess: z.boolean(),
    contactFormLeadCapture: z.boolean(),
    liveChatWidgetTawk: z.boolean(),
    appointmentBookingCalendly: z.boolean(),
    businessEmailInboxes: nonNegInt,
    basicMetaTagsSitemap: z.boolean(),
    fullSeoSetup: z.boolean(),
    googleBusinessProfileSetup: z.boolean(),
    monthlySeoHealthReport: z.boolean(),
    blogCmsAccess: z.boolean(),
    socialMediaFeedEmbed: z.boolean(),
    googleShoppingIntegration: z.boolean(),
    automatedDailyBackups: z.boolean(),
    uptimeMonitoringAlerts: z.boolean(),
    cookieGdprComplianceBanner: z.boolean(),
    monthlySecurityScan: z.boolean(),
    /** Display string, e.g. `$12/edit` or `5 for $49`. Empty keeps existing cent fields. */
    extraEditPricing: z.string().max(160),
    supportChannel: z.string().min(1).max(120),
    dedicatedAccountContact: z.boolean(),
  })
  .strict();

/**
 * @param {string} s
 * @returns {{ extraEditSingleCents?: number, extraEditPackCount?: number, extraEditPackCents?: number }}
 */
export function parseExtraEditPricingString(s) {
  const t = String(s ?? "").trim();
  if (!t) return {};
  const single = t.match(/^\s*\(?\s*\$\s*(\d+(?:\.\d+)?)\s*\)?\s*\/\s*edit\s*$/i);
  if (single) {
    const dollars = parseFloat(single[1]);
    if (!Number.isFinite(dollars) || dollars <= 0) throw new Error("invalid_extra_edit_pricing");
    return { extraEditSingleCents: Math.round(dollars * 100) };
  }
  const pack = t.match(/^\s*\(?\s*(\d+)\s*\)?\s+for\s+\(?\s*\$\s*(\d+(?:\.\d+)?)\s*\)?\s*$/i);
  if (pack) {
    const count = parseInt(pack[1], 10);
    const dollars = parseFloat(pack[2]);
    if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(dollars) || dollars <= 0) {
      throw new Error("invalid_extra_edit_pricing");
    }
    return { extraEditPackCount: count, extraEditPackCents: Math.round(dollars * 100) };
  }
  throw new Error("invalid_extra_edit_pricing");
}

/**
 * Merge validated website catalog fields onto existing JSON and sync legacy keys
 * used elsewhere (pages cap, setup fee cents, extra-edit addons, older booleans).
 * @param {unknown} existingCatalog
 * @param {unknown} incomingWebsite
 */
export function mergePlanWebsiteCatalogJson(existingCatalog, incomingWebsite) {
  const existing =
    existingCatalog && typeof existingCatalog === "object" && !Array.isArray(existingCatalog)
      ? { ...existingCatalog }
      : {};
  const validated = planWebsiteCatalogSchema.parse(incomingWebsite);
  const { extraEditPricing, ...rest } = validated;

  let next = { ...existing, ...rest };
  const setupCents = Math.round(validated.oneTimeSetupFeeUsd * 100);
  next.setupFeeMinCents = setupCents;
  next.setupFeeMaxCents = setupCents;
  next.pagesIncludedMax = validated.pagesIncluded;

  next.liveChatIncluded = validated.liveChatWidgetTawk;
  next.bookingIncluded = validated.appointmentBookingCalendly;
  next.cookieGdprBanner = validated.cookieGdprComplianceBanner;
  next.uptimeMonitoring = validated.uptimeMonitoringAlerts;
  next.automatedBackups = validated.automatedDailyBackups;
  next.socialFeedEmbed = validated.socialMediaFeedEmbed;
  next.googleShopping = validated.googleShoppingIntegration;
  next.fullSeoSetupOneTime = validated.fullSeoSetup;
  next.googleBusinessProfileOneTime = validated.googleBusinessProfileSetup;
  next.monthlySeoReport = validated.monthlySeoHealthReport;

  const pricingTrim = extraEditPricing.trim();
  if (pricingTrim) {
    const parsed = parseExtraEditPricingString(pricingTrim);
    if (parsed.extraEditSingleCents != null) {
      next.extraEditSingleCents = parsed.extraEditSingleCents;
    }
    if (parsed.extraEditPackCount != null && parsed.extraEditPackCents != null) {
      next.extraEditPackCount = parsed.extraEditPackCount;
      next.extraEditPackCents = parsed.extraEditPackCents;
    }
    next.extraEditPricing = pricingTrim;
  } else {
    delete next.extraEditPricing;
  }

  return next;
}
