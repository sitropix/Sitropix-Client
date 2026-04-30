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
  billingCycle: BillingCycle | null;
  addons: string[];
  invoices: ProjectInvoice[];
}

