import type { BillingCycle } from "@/types/subscription";
import type { ProjectRecord, ProjectRequirementType } from "@/types/project";

const STORAGE_KEY = "zohoportal_projects_v1";

export const REQUIRED_PROJECT_ASSETS: Array<{ type: ProjectRequirementType; label: string }> = [
  { type: "requirements", label: "Requirement documents" },
  { type: "branding", label: "Branding assets" },
  { type: "logos", label: "Logos" },
  { type: "brand_voice", label: "Brand voice guidelines" },
  { type: "logs", label: "Logs" },
  { type: "catalog", label: "Product catalogues" },
];

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function readAll(): ProjectRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: ProjectRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function listProjectsByUser(userId: string): ProjectRecord[] {
  return readAll()
    .filter((p) => p.ownerUserId === userId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function getProjectById(projectId: string): ProjectRecord | null {
  return readAll().find((p) => p.id === projectId) ?? null;
}

export function createProject(userId: string, name: string, description: string): ProjectRecord {
  const next: ProjectRecord = {
    id: uid("proj"),
    ownerUserId: userId,
    name: name.trim(),
    description: description.trim(),
    createdAt: nowIso(),
    assets: [],
    subscriptionStatus: "not_started",
    planId: null,
    planName: null,
    billingCycle: null,
    addons: [],
    invoices: [],
  };
  const all = readAll();
  all.push(next);
  writeAll(all);
  return next;
}

export function uploadProjectAsset(projectId: string, type: ProjectRequirementType, fileName: string): ProjectRecord | null {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === projectId);
  if (idx < 0) return null;
  const project = all[idx]!;
  const withoutType = project.assets.filter((a) => a.type !== type);
  project.assets = [...withoutType, { id: uid("asset"), type, fileName, uploadedAt: nowIso() }];
  if (project.subscriptionStatus === "not_started") {
    project.subscriptionStatus = "on_hold";
  }
  all[idx] = project;
  writeAll(all);
  return project;
}

export function hasAllRequiredAssets(project: ProjectRecord): boolean {
  return REQUIRED_PROJECT_ASSETS.every((req) => project.assets.some((asset) => asset.type === req.type));
}

export function activateProjectSubscription(
  projectId: string,
  payload: { planId: string; planName: string; billingCycle: BillingCycle; amountCents: number; currency: string },
): ProjectRecord | null {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === projectId);
  if (idx < 0) return null;
  const project = all[idx]!;
  const invoiceNumber = `PRJ-${project.name.slice(0, 3).toUpperCase() || "NEW"}-${String(project.invoices.length + 1).padStart(4, "0")}`;
  project.subscriptionStatus = "active";
  project.planId = payload.planId;
  project.planName = payload.planName;
  project.billingCycle = payload.billingCycle;
  project.invoices = [
    {
      id: uid("inv"),
      invoiceNumber,
      amountCents: payload.amountCents,
      currency: payload.currency,
      status: "succeeded",
      paidAt: nowIso(),
    },
    ...project.invoices,
  ];
  all[idx] = project;
  writeAll(all);
  return project;
}

export function toggleProjectAddon(projectId: string, addonCode: string): ProjectRecord | null {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === projectId);
  if (idx < 0) return null;
  const project = all[idx]!;
  project.addons = project.addons.includes(addonCode)
    ? project.addons.filter((a) => a !== addonCode)
    : [...project.addons, addonCode];
  all[idx] = project;
  writeAll(all);
  return project;
}

