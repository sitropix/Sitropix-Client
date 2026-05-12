import { api } from "@/services/http";
import type { BillingCycle, Plan } from "@/types/subscription";
import type { ProjectRecord, ProjectRequirementType } from "@/types/project";

/** All intake file categories users may upload (optional beyond the core set). */
export const PROJECT_ASSET_TYPES: Array<{ type: ProjectRequirementType; label: string }> = [
  { type: "requirements", label: "Requirement documents" },
  { type: "branding", label: "Branding assets" },
  { type: "logos", label: "Logos" },
  { type: "brand_voice", label: "Brand voice guidelines" },
  { type: "logs", label: "Logs" },
  { type: "catalog", label: "Product catalogues" },
];

/** Minimum uploads expected for every project before checkout / leaving draft onboarding. */
export const CORE_REQUIRED_PROJECT_ASSETS: Array<{ type: ProjectRequirementType; label: string }> = [
  { type: "requirements", label: "Requirement documents" },
  { type: "branding", label: "Branding assets" },
];

function normalizeProject(project: ProjectRecord): ProjectRecord {
  const normalized: ProjectRecord = {
    ...project,
    planValidUntil: project.planValidUntil ?? null,
  };
  if (!normalized.planId) {
    if (normalized.subscriptionStatus === "active") normalized.subscriptionStatus = "on_hold";
    return normalized;
  }
  if (normalized.subscriptionStatus !== "active") return normalized;
  if (!normalized.planValidUntil) {
    normalized.subscriptionStatus = "on_hold";
    return normalized;
  }
  if (new Date(normalized.planValidUntil).getTime() <= Date.now()) {
    normalized.subscriptionStatus = "on_hold";
  }
  return normalized;
}

let listProjectsInFlight: Promise<ProjectRecord[]> | null = null;

export async function listProjectsByUser(_userId: string, opts?: { force?: boolean }): Promise<ProjectRecord[]> {
  if (!opts?.force && listProjectsInFlight) {
    return listProjectsInFlight;
  }
  listProjectsInFlight = api<ProjectRecord[]>("/api/projects")
    .then((rows) => rows.map(normalizeProject))
    .finally(() => {
      listProjectsInFlight = null;
    });
  return listProjectsInFlight;
}

export async function getProjectById(projectId: string): Promise<ProjectRecord | null> {
  try {
    const row = await api<ProjectRecord>(`/api/projects/${encodeURIComponent(projectId)}`);
    return normalizeProject(row);
  } catch {
    return null;
  }
}

export async function createProject(_userId: string, name: string, description: string): Promise<ProjectRecord> {
  const created = await api<ProjectRecord>("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: name.trim(), description: description.trim() }),
  });
  return normalizeProject(created);
}

export function hasAllRequiredAssets(project: ProjectRecord): boolean {
  return CORE_REQUIRED_PROJECT_ASSETS.every((req) =>
    project.assets.some((asset) => asset.type === req.type),
  );
}

export function hasValidProjectPlan(project: ProjectRecord): boolean {
  if (project.subscriptionStatus !== "active" || !project.planId || !project.planValidUntil) return false;
  return new Date(project.planValidUntil).getTime() > Date.now();
}

/** Lowest index = entry tier. Requires non-empty `plans`. */
export function planTierIndex(planId: string | null | undefined, plans: Plan[]): number {
  if (!planId || plans.length === 0) return -1;
  const sorted = [...plans].sort((a, b) => a.priceMonthlyCents - b.priceMonthlyCents);
  return sorted.findIndex((p) => p.id === planId);
}

export function isHighestPricedPlan(planId: string | null | undefined, plans: Plan[]): boolean {
  if (!planId || plans.length === 0) return false;
  const sorted = [...plans].sort((a, b) => b.priceMonthlyCents - a.priceMonthlyCents);
  return sorted[0]?.id === planId;
}

export async function activateProjectSubscription(
  projectId: string,
  payload: {
    planId: string;
    planName: string;
    billingCycle: BillingCycle;
    amountCents: number;
    currency: string;
    planValidUntil: string;
    addons?: string[];
  },
): Promise<ProjectRecord> {
  const row = await api<ProjectRecord>(`/api/projects/${encodeURIComponent(projectId)}/activate-subscription`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeProject(row);
}

export async function toggleProjectAddon(projectId: string, addonCode: string): Promise<ProjectRecord | null> {
  try {
    const row = await api<ProjectRecord>(`/api/projects/${encodeURIComponent(projectId)}/addons/toggle`, {
      method: "POST",
      body: JSON.stringify({ addonCode }),
    });
    return normalizeProject(row);
  } catch {
    return null;
  }
}

export interface ProjectSubscriptionRecord {
  id: string;
  userId: string;
  projectId: string | null;
  project: { id: string; name: string; subscriptionStatus: string } | null;
  planId: string;
  status: "trialing" | "active" | "paused" | "canceled" | "past_due";
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  pausedAt: string | null;
  canceledAt: string | null;
  nextBillingDate: string;
  plan: {
    id: string;
    code: string;
    name: string;
    description: string;
    priceMonthlyCents: number;
    priceYearlyCents: number;
    currency: string;
    features: string[];
    isActive: boolean;
    trialDays: number;
  } | null;
}

export async function listProjectSubscriptions(): Promise<ProjectSubscriptionRecord[]> {
  return api<ProjectSubscriptionRecord[]>("/api/projects/subscriptions");
}

export interface ProjectSubscriptionDetailsRecord {
  subscription: {
    id: string;
    userId: string;
    projectId: string;
    planId: string;
    status: "trialing" | "active" | "paused" | "canceled" | "past_due";
    billingCycle: BillingCycle;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    pausedAt: string | null;
    canceledAt: string | null;
  };
  project: { id: string; name: string; subscriptionStatus: string } | null;
  plan: {
    id: string;
    code: string;
    name: string;
    currency: string;
    priceMonthlyCents: number;
    priceYearlyCents: number;
  } | null;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amountCents: number;
    currency: string;
    status: "succeeded" | "failed" | "pending" | "refunded";
    paidAt: string | null;
    invoicePdfUrl: string | null;
  }>;
  /** Default payment method on the Stripe subscription (from Stripe), if known. */
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
}

export async function listProjectSubscriptionDetails(): Promise<ProjectSubscriptionDetailsRecord[]> {
  return api<ProjectSubscriptionDetailsRecord[]>("/api/projects/subscriptions/details");
}

