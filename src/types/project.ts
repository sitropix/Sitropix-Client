import type { BillingCycle } from "@/types/subscription";

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
}

