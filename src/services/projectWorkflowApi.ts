import { api } from "@/services/http";
import type {
  AdminProjectBoardBuckets,
  AdminProjectOverview,
  DesignerQueueRow,
  ProjectActivityEvent,
  ProjectChatMessage,
  ProjectFinancePayload,
  ProjectMultiSummary,
  ProjectPublicShareView,
  ProjectShareLinkInfo,
  ProjectTicketSummary,
  ProjectWorkflowSnapshot,
  ProjectWorkflowStatus,
  StaffUserRef,
} from "@/types/projectWorkflow";

const p = (id: string) => encodeURIComponent(id);

/* ──────────────────── Workflow snapshot ──────────────────── */
export function getProjectWorkflow(projectId: string): Promise<ProjectWorkflowSnapshot> {
  return api<ProjectWorkflowSnapshot>(`/api/projects/${p(projectId)}/workflow`);
}

export function updateProjectWorkflow(
  projectId: string,
  body: { workflowStatus?: ProjectWorkflowStatus; phaseProgressPercent?: number; reason?: string },
): Promise<ProjectWorkflowSnapshot> {
  return api<ProjectWorkflowSnapshot>(`/api/projects/${p(projectId)}/workflow`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/* ──────────────────── Chat ──────────────────── */
export function listProjectChat(projectId: string): Promise<{ items: ProjectChatMessage[] }> {
  return api(`/api/projects/${p(projectId)}/chat?limit=200`);
}

export function postProjectChat(
  projectId: string,
  body: string,
  markWaitingForCustomerReply = false,
): Promise<{ id: string; createdAt: string; isStaff: boolean }> {
  return api(`/api/projects/${p(projectId)}/chat`, {
    method: "POST",
    body: JSON.stringify({ body, markWaitingForCustomerReply }),
  });
}

export function markProjectChatRead(projectId: string): Promise<{ ok: true }> {
  return api(`/api/projects/${p(projectId)}/chat/mark-read`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/* ──────────────────── Settings ──────────────────── */
export function patchProjectSettings(
  projectId: string,
  body: { brandVoiceShort?: string; notifyOnDesignerReply?: boolean; notifyOnPhaseChange?: boolean },
): Promise<ProjectWorkflowSnapshot> {
  return api(`/api/projects/${p(projectId)}/settings`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function patchProjectUrls(
  projectId: string,
  body: { stagingUrl?: string; liveUrl?: string },
): Promise<ProjectWorkflowSnapshot> {
  return api(`/api/projects/${p(projectId)}/urls`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/* ──────────────────── Approval ──────────────────── */
export function approveProject(
  projectId: string,
  kind: "design" | "launch",
  note?: string,
): Promise<ProjectWorkflowSnapshot> {
  return api(`/api/projects/${p(projectId)}/approve`, {
    method: "POST",
    body: JSON.stringify({ kind, ...(note ? { note } : {}) }),
  });
}

/* ──────────────────── Finance / Tickets / Activity ──────────────────── */
export function getProjectFinance(projectId: string): Promise<ProjectFinancePayload> {
  return api(`/api/projects/${p(projectId)}/finance`);
}

export function getProjectActivity(projectId: string): Promise<{ items: ProjectActivityEvent[] }> {
  return api(`/api/projects/${p(projectId)}/activity?limit=25`);
}

export function getProjectTickets(projectId: string): Promise<{ items: ProjectTicketSummary[] }> {
  return api(`/api/projects/${p(projectId)}/tickets`);
}

/* ──────────────────── Pending checkout (draft-resume) ──────────────────── */
export function setPendingCheckout(projectId: string, sessionId: string): Promise<{ ok: true }> {
  return api(`/api/projects/${p(projectId)}/pending-checkout`, {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export function clearPendingCheckout(projectId: string): Promise<{ ok: true }> {
  return api(`/api/projects/${p(projectId)}/pending-checkout/clear`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/* ──────────────────── Share link ──────────────────── */
export function issueProjectShareLink(
  projectId: string,
  expiresInDays?: number | null,
): Promise<ProjectShareLinkInfo> {
  return api(`/api/projects/${p(projectId)}/share-link`, {
    method: "POST",
    body: JSON.stringify({ expiresInDays: expiresInDays ?? null }),
  });
}

export function revokeProjectShareLink(projectId: string): Promise<{ ok: true }> {
  return api(`/api/projects/${p(projectId)}/share-link`, { method: "DELETE" });
}

export function getPublicProjectShareView(token: string): Promise<ProjectPublicShareView> {
  return api(`/api/share/projects/${encodeURIComponent(token)}`);
}

/* ──────────────────── Multi-project roll-up ──────────────────── */
export function getProjectsRollUp(): Promise<ProjectMultiSummary> {
  return api(`/api/projects/roll-up/summary`);
}

/* ──────────────────── Admin designer endpoints ──────────────────── */
export function listAdminStaff(): Promise<{ items: StaffUserRef[] }> {
  return api(`/api/admin/designer/staff`);
}

export function getDesignerQueue(scope: "mine" | "all" = "mine", status?: ProjectWorkflowStatus | ""):
  Promise<{ scope: "mine" | "all"; items: DesignerQueueRow[] }> {
  const q = new URLSearchParams({ scope });
  if (status) q.set("status", status);
  return api(`/api/admin/designer/queue?${q.toString()}`);
}

export function getAdminProjectBoard(): Promise<AdminProjectBoardBuckets> {
  return api(`/api/admin/designer/board`);
}

export function getAdminProjectOverview(): Promise<AdminProjectOverview> {
  return api(`/api/admin/designer/overview`);
}

export function assignProjectDesigner(
  projectId: string,
  designerUserId: string | null,
): Promise<ProjectWorkflowSnapshot> {
  return api(`/api/admin/designer/projects/${p(projectId)}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ designerUserId }),
  });
}

export function runWeeklyDigestNow(): Promise<{ totalCandidates: number; sent: number; skipped: number }> {
  return api(`/api/admin/designer/digest/run-now`, { method: "POST", body: JSON.stringify({}) });
}
