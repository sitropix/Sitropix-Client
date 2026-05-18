import { z } from "zod";

const posDollar = z.number().finite().positive();
const posInt = z.number().int().positive();
const nonNegInt = z.number().int().nonnegative();

const supportChannelSchema = z.enum(["email_48h", "email_chat_24h", "priority_4h"]);

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
    supportChannel: supportChannelSchema,
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

  let next = { ...existing, ...validated };
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

  return next;
}
