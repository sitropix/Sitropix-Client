import { api } from "@/services/http";
import type { BillingCycle } from "@/types/subscription";
import type { ProjectRecord, ProjectRequirementType } from "@/types/project";

export const REQUIRED_PROJECT_ASSETS: Array<{ type: ProjectRequirementType; label: string }> = [
  { type: "requirements", label: "Requirement documents" },
  { type: "branding", label: "Branding assets" },
  { type: "logos", label: "Logos" },
  { type: "brand_voice", label: "Brand voice guidelines" },
  { type: "logs", label: "Logs" },
  { type: "catalog", label: "Product catalogues" },
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
  return REQUIRED_PROJECT_ASSETS.every((req) => project.assets.some((asset) => asset.type === req.type));
}

export function hasValidProjectPlan(project: ProjectRecord): boolean {
  if (project.subscriptionStatus !== "active" || !project.planId || !project.planValidUntil) return false;
  return new Date(project.planValidUntil).getTime() > Date.now();
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

