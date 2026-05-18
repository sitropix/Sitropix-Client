import type { AddonBillingKind, BillingCycle } from "@/types/subscription";

/** Add-on card returned by `GET /api/projects/:id` for dashboard display. */
export interface ProjectAddonRecurringPriceOptions {
  monthlyPriceCents?: number;
  yearlyPriceCents?: number;
}

export interface ProjectAddonCard {
  code: string;
  label: string;
  desc: string;
  currency: string;
  billingKind: AddonBillingKind;
  displayPriceCents: number;
  setupFeeCents: number;
  recurringPriceCents?: number;
  creditsLabel?: string;
  hasSetupPlusRecurring: boolean;
  recurringPriceOptions?: ProjectAddonRecurringPriceOptions;
  canChooseRecurringCycle?: boolean;
  defaultRecurringCycle?: BillingCycle;
}

export interface ProjectAddonBillingContext {
  subscriptionBillingCycle: BillingCycle;
  periodStartIso: string | null;
  canChooseRecurringAddonCycle: boolean;
}

export interface ProjectAccessibleAddons {
  existing: ProjectAddonCard[];
  purchasable: ProjectAddonCard[];
  billingContext?: ProjectAddonBillingContext;
}

export interface ProjectExtraEditPurchase {
  available: boolean;
  currency: string;
  perEditCents: number;
  bundleCredits: number;
  bundleCents: number;
  singleAddonCode?: string | null;
  bundleAddonCode?: string | null;
}

export type ProjectRequirementType =
  | "requirements"
  | "branding"
  | "logos"
  | "brand_voice"
  | "logs"
  | "catalog";

export type ProjectSubscriptionStatus = "not_started" | "on_hold" | "active";

export interface ProjectAsset {
  id: string;
  type: ProjectRequirementType;
  fileName: string;
  uploadedAt: string;
}

export interface ProjectInvoice {
  id: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  status: "succeeded" | "pending" | "failed";
  paidAt: string | null;
}

/** Present on `GET /api/projects/:id` when a subscription exists for the project. */
export interface ProjectUsageSnapshot {
  includedCreditsPerPeriod: number;
  includedCreditsUsedThisPeriod: number;
  purchasedCreditsBalance: number;
  pagesIncludedMax: number | null;
  /** Reserved for future page-build tracking; omitted or null until populated. */
  pagesUsed: number | null;
}

export interface ProjectRecord {
  id: string;
  ownerUserId: string;
  name: string;
  description: string;
  createdAt: string;
  assets: ProjectAsset[];
  subscriptionStatus: ProjectSubscriptionStatus;
  planId: string | null;
  planName: string | null;
  planValidUntil: string | null;
  billingCycle: BillingCycle | null;
  addons: string[];
  invoices: ProjectInvoice[];
  /** Subscription usage (edits, page cap); only on single-project fetch. */
  usage?: ProjectUsageSnapshot | null;
  /** Plan-scoped add-ons for dashboard; only on single-project fetch. */
  accessibleAddons?: ProjectAccessibleAddons;
  /** Extra edit credit checkout summary; only on single-project fetch. */
  extraEditPurchase?: ProjectExtraEditPurchase;
}

