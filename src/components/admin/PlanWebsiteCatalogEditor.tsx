import type { Plan } from "@/types/subscription";
import type { ReactNode } from "react";

export type SupportChannelCode = "email_48h" | "email_chat_24h" | "priority_4h";

export const SUPPORT_CHANNEL_OPTIONS: { value: SupportChannelCode; label: string }[] = [
  { value: "email_48h", label: "Email (48h)" },
  { value: "email_chat_24h", label: "Email+Chat (24h)" },
  { value: "priority_4h", label: "Priority (4h)" },
];

export type PlanWebsiteCatalogValues = {
  listPriceUsd: number;
  oneTimeSetupFeeUsd: number;
  onboardingTurnaround: string;
  websiteType: string;
  pagesIncluded: number;
  designLevel: string;
  mobileResponsive: boolean;
  customDomainSsl: boolean;
  productCatalog: string;
  shoppingCartCheckout: boolean;
  paymentGateway: boolean;
  productCmsAccess: boolean;
  contactFormLeadCapture: boolean;
  liveChatWidgetTawk: boolean;
  appointmentBookingCalendly: boolean;
  businessEmailInboxes: number;
  basicMetaTagsSitemap: boolean;
  fullSeoSetup: boolean;
  googleBusinessProfileSetup: boolean;
  monthlySeoHealthReport: boolean;
  blogCmsAccess: boolean;
  socialMediaFeedEmbed: boolean;
  googleShoppingIntegration: boolean;
  automatedDailyBackups: boolean;
  uptimeMonitoringAlerts: boolean;
  cookieGdprComplianceBanner: boolean;
  monthlySecurityScan: boolean;
  supportChannel: SupportChannelCode;
  dedicatedAccountContact: boolean;
};

function num(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v.replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function intNonNeg(v: unknown, fallback: number): number {
  const n = Math.floor(num(v, fallback));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function intPos(v: unknown, fallback: number): number {
  const n = Math.floor(num(v, fallback));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function str(v: unknown, fallback: string): string {
  if (typeof v === "string") return v;
  if (v === undefined || v === null) return fallback;
  return String(v);
}

function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return fallback;
}

function normalizeSupportChannel(raw: string): SupportChannelCode {
  const s = raw.trim().toLowerCase();
  if (s === "email_chat_24h" || s === "email+chat_24h" || s.includes("chat")) {
    return "email_chat_24h";
  }
  if (s === "priority_4h" || s.includes("priority")) {
    return "priority_4h";
  }
  if (s === "email_48h" || s === "email" || s === "") {
    return "email_48h";
  }
  const hit = SUPPORT_CHANNEL_OPTIONS.find((o) => o.value === s);
  return hit ? hit.value : "email_48h";
}

function defaultProductCatalog(j: Record<string, unknown>): string {
  const pc = str(j.productCatalog, "").trim();
  if (pc) return pc;
  const cap = j.ecommerceProductCap;
  if (typeof cap === "number" && Number.isFinite(cap)) {
    if (cap <= 0) return "None";
    return `Up to ${Math.floor(cap)} products`;
  }
  return "None";
}

function defaultOnboarding(j: Record<string, unknown>): string {
  const o = str(j.onboardingTurnaround, "").trim();
  if (o) return o;
  const min = intNonNeg(j.onboardingDaysMin, 0);
  const max = intNonNeg(j.onboardingDaysMax, 0);
  if (min > 0 && max > 0) return `${min}–${max} business days`;
  if (min > 0) return `${min}+ business days`;
  return "5–10 business days";
}

function setupFeeUsdFromLegacy(j: Record<string, unknown>): number {
  const direct = num(j.oneTimeSetupFeeUsd, NaN);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const minC = intNonNeg(j.setupFeeMinCents, 0);
  const maxC = intNonNeg(j.setupFeeMaxCents, 0);
  if (minC > 0 && maxC > 0) return (minC + maxC) / 2 / 100;
  if (minC > 0) return minC / 100;
  return 99;
}

function ecommerceCap(j: Record<string, unknown>): number {
  return intNonNeg(j.ecommerceProductCap, 0);
}

/** Hydrate admin form state from `plan` + legacy `catalogJson` keys. */
export function planWebsiteCatalogValuesFromPlan(
  plan: Plan,
): PlanWebsiteCatalogValues {
  const j = (
    plan.catalogJson &&
    typeof plan.catalogJson === "object" &&
    !Array.isArray(plan.catalogJson)
      ? plan.catalogJson
      : {}
  ) as Record<string, unknown>;
  const monthlyUsd = Math.max(0.01, plan.priceMonthlyCents / 100);
  const cap = ecommerceCap(j);
  const hasStore = cap > 0;
  return {
    listPriceUsd: num(j.listPriceUsd, monthlyUsd),
    oneTimeSetupFeeUsd: setupFeeUsdFromLegacy(j),
    onboardingTurnaround: defaultOnboarding(j),
    websiteType: str(j.websiteType, "Business website"),
    pagesIncluded: intPos(j.pagesIncluded ?? j.pagesIncludedMax, 5),
    designLevel: str(j.designLevel, "Template-based"),
    mobileResponsive: bool(j.mobileResponsive, true),
    customDomainSsl: bool(j.customDomainSsl, true),
    productCatalog: defaultProductCatalog(j),
    shoppingCartCheckout: bool(j.shoppingCartCheckout, hasStore),
    paymentGateway: bool(j.paymentGateway, hasStore),
    productCmsAccess: bool(j.productCmsAccess, hasStore),
    contactFormLeadCapture: bool(j.contactFormLeadCapture, true),
    liveChatWidgetTawk: bool(j.liveChatWidgetTawk ?? j.liveChatIncluded, false),
    appointmentBookingCalendly: bool(
      j.appointmentBookingCalendly ?? j.bookingIncluded,
      false,
    ),
    businessEmailInboxes: intNonNeg(j.businessEmailInboxes, 0),
    basicMetaTagsSitemap: bool(j.basicMetaTagsSitemap, true),
    fullSeoSetup: bool(j.fullSeoSetup ?? j.fullSeoSetupOneTime, false),
    googleBusinessProfileSetup: bool(
      j.googleBusinessProfileSetup ?? j.googleBusinessProfileOneTime,
      false,
    ),
    monthlySeoHealthReport: bool(
      j.monthlySeoHealthReport ?? j.monthlySeoReport,
      false,
    ),
    blogCmsAccess: bool(j.blogCmsAccess, false),
    socialMediaFeedEmbed: bool(
      j.socialMediaFeedEmbed ?? j.socialFeedEmbed,
      false,
    ),
    googleShoppingIntegration: bool(
      j.googleShoppingIntegration ?? j.googleShopping,
      false,
    ),
    automatedDailyBackups: bool(
      j.automatedDailyBackups ?? j.automatedBackups,
      true,
    ),
    uptimeMonitoringAlerts: bool(
      j.uptimeMonitoringAlerts ?? j.uptimeMonitoring,
      true,
    ),
    cookieGdprComplianceBanner: bool(
      j.cookieGdprComplianceBanner ?? j.cookieGdprBanner,
      true,
    ),
    monthlySecurityScan: bool(j.monthlySecurityScan, false),
    supportChannel: normalizeSupportChannel(str(j.supportChannel, "")),
    dedicatedAccountContact: bool(j.dedicatedAccountContact, false),
  };
}

export function planWebsiteCatalogValuesToPayload(
  v: PlanWebsiteCatalogValues,
): Record<string, unknown> {
  return {
    listPriceUsd: v.listPriceUsd,
    oneTimeSetupFeeUsd: v.oneTimeSetupFeeUsd,
    onboardingTurnaround: v.onboardingTurnaround.trim(),
    websiteType: v.websiteType.trim(),
    pagesIncluded: v.pagesIncluded,
    designLevel: v.designLevel.trim(),
    mobileResponsive: v.mobileResponsive,
    customDomainSsl: v.customDomainSsl,
    productCatalog: v.productCatalog.trim(),
    shoppingCartCheckout: v.shoppingCartCheckout,
    paymentGateway: v.paymentGateway,
    productCmsAccess: v.productCmsAccess,
    contactFormLeadCapture: v.contactFormLeadCapture,
    liveChatWidgetTawk: v.liveChatWidgetTawk,
    appointmentBookingCalendly: v.appointmentBookingCalendly,
    businessEmailInboxes: v.businessEmailInboxes,
    basicMetaTagsSitemap: v.basicMetaTagsSitemap,
    fullSeoSetup: v.fullSeoSetup,
    googleBusinessProfileSetup: v.googleBusinessProfileSetup,
    monthlySeoHealthReport: v.monthlySeoHealthReport,
    blogCmsAccess: v.blogCmsAccess,
    socialMediaFeedEmbed: v.socialMediaFeedEmbed,
    googleShoppingIntegration: v.googleShoppingIntegration,
    automatedDailyBackups: v.automatedDailyBackups,
    uptimeMonitoringAlerts: v.uptimeMonitoringAlerts,
    cookieGdprComplianceBanner: v.cookieGdprComplianceBanner,
    monthlySecurityScan: v.monthlySecurityScan,
    supportChannel: v.supportChannel,
    dedicatedAccountContact: v.dedicatedAccountContact,
  };
}

type Props = {
  value: PlanWebsiteCatalogValues;
  onChange: (next: PlanWebsiteCatalogValues) => void;
};

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
      {children}
    </span>
  );
}

function rowCls() {
  return "grid gap-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:grid-cols-2";
}

export function PlanWebsiteCatalogEditor({ value, onChange }: Props) {
  const patch = (p: Partial<PlanWebsiteCatalogValues>) =>
    onChange({ ...value, ...p });

  return (
    <div className="space-y-3 rounded-lg border border-[#24292E] bg-[#101317] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
        Website package catalog
      </p>
      <div className={rowCls()}>
        <label className="flex flex-col gap-1">
          <FieldLabel>Price</FieldLabel>
          <input
            type="number"
            min={0.01}
            step="0.01"
            value={value.listPriceUsd}
            onChange={(e) =>
              patch({
                listPriceUsd: Math.max(
                  0.01,
                  parseFloat(e.target.value) || 0.01,
                ),
              })
            }
            className="rounded border border-[#2A3037] bg-[#15191C] px-2 py-1.5 text-[11px] text-white"
          />
        </label>
        <label className="flex flex-col gap-1">
          <FieldLabel>One-time setup fee</FieldLabel>
          <input
            type="number"
            min={0.01}
            step="0.01"
            value={value.oneTimeSetupFeeUsd}
            onChange={(e) =>
              patch({
                oneTimeSetupFeeUsd: Math.max(
                  0.01,
                  parseFloat(e.target.value) || 0.01,
                ),
              })
            }
            className="rounded border border-[#2A3037] bg-[#15191C] px-2 py-1.5 text-[11px] text-white"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <FieldLabel>Onboarding turnaround</FieldLabel>
          <input
            value={value.onboardingTurnaround}
            onChange={(e) => patch({ onboardingTurnaround: e.target.value })}
            placeholder="e.g. 5–7 business days"
            className="rounded border border-[#2A3037] bg-[#15191C] px-2 py-1.5 text-[11px] text-white"
          />
        </label>
      </div>
      <div className={rowCls()}>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <FieldLabel>Website type</FieldLabel>
          <input
            value={value.websiteType}
            onChange={(e) => patch({ websiteType: e.target.value })}
            className="rounded border border-[#2A3037] bg-[#15191C] px-2 py-1.5 text-[11px] text-white"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <FieldLabel>Design level</FieldLabel>
          <input
            value={value.designLevel}
            onChange={(e) => patch({ designLevel: e.target.value })}
            className="rounded border border-[#2A3037] bg-[#15191C] px-2 py-1.5 text-[11px] text-white"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <FieldLabel>Pages included</FieldLabel>
          <input
            type="number"
            min={1}
            step={1}
            value={value.pagesIncluded}
            onChange={(e) =>
              patch({
                pagesIncluded: Math.max(1, parseInt(e.target.value, 10) || 1),
              })
            }
            className="rounded border border-[#2A3037] bg-[#15191C] px-2 py-1.5 text-[11px] text-white"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <FieldLabel>Product catalog</FieldLabel>
        <input
          value={value.productCatalog}
          onChange={(e) => patch({ productCatalog: e.target.value })}
          placeholder='e.g. "None" or "Up to 50 SKUs"'
          className="rounded border border-[#2A3037] bg-[#15191C] px-2 py-1.5 text-[11px] text-white"
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["mobileResponsive", "Mobile responsive"],
            ["customDomainSsl", "Custom domain + SSL"],
            ["shoppingCartCheckout", "Shopping cart + checkout"],
            ["paymentGateway", "Payment gateway"],
            ["productCmsAccess", "Product CMS access"],
            ["contactFormLeadCapture", "Contact form + lead capture"],
            ["liveChatWidgetTawk", "Live chat (Tawk.to)"],
            ["appointmentBookingCalendly", "Appointments (Calendly)"],
            ["basicMetaTagsSitemap", "Basic meta tags + sitemap"],
            ["fullSeoSetup", "Full SEO setup"],
            ["googleBusinessProfileSetup", "Google Business Profile"],
            ["monthlySeoHealthReport", "Monthly SEO health report"],
            ["blogCmsAccess", "Blog / CMS access"],
            ["socialMediaFeedEmbed", "Social feed embed"],
            ["googleShoppingIntegration", "Google Shopping"],
            ["automatedDailyBackups", "Automated daily backups"],
            ["uptimeMonitoringAlerts", "Uptime monitoring + alerts"],
            ["cookieGdprComplianceBanner", "Cookie / GDPR banner"],
            ["monthlySecurityScan", "Monthly security scan"],
            ["dedicatedAccountContact", "Dedicated account contact"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-2 rounded border border-[#2A3037]/80 bg-[#15191C] px-2 py-1.5 text-[11px] text-zinc-200"
          >
            <input
              type="checkbox"
              checked={value[key]}
              onChange={(e) =>
                patch({
                  [key]: e.target.checked,
                } as Partial<PlanWebsiteCatalogValues>)
              }
              className="accent-brand-lime"
            />
            {label}
          </label>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <FieldLabel>Business email inboxes</FieldLabel>
          <input
            type="number"
            min={0}
            step={1}
            value={value.businessEmailInboxes}
            onChange={(e) =>
              patch({
                businessEmailInboxes: Math.max(
                  0,
                  parseInt(e.target.value, 10) || 0,
                ),
              })
            }
            className="rounded border border-[#2A3037] bg-[#15191C] px-2 py-1.5 text-[11px] text-white"
          />
        </label>
        <label className="flex flex-col gap-1">
          <FieldLabel>Support channel type</FieldLabel>
          <select
            value={value.supportChannel}
            onChange={(e) =>
              patch({ supportChannel: e.target.value as SupportChannelCode })
            }
            className="rounded border border-[#2A3037] bg-[#15191C] px-2 py-1.5 text-[11px] text-white"
          >
            {SUPPORT_CHANNEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
