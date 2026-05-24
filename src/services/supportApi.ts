import type {
  AdminTicketCategoryScope,
  AdminSupportTicketListItem,
  CreateTicketInput,
  KBArticle,
  KBCategory,
  AddonTicketOption,
  SupportEditType,
  SupportTicket,
  SupportTicketDetail,
  TicketStatus,
} from "@/types/support";
import { api, apiBlob, ApiRequestError, userFacingApiError } from "@/services/http";

/** User-visible copy when POST /api/support/tickets fails. */
const ADDON_TICKET_ERROR_CODES = new Set([
  "addon_not_owned",
  "addon_already_utilized",
  "addon_ticket_already_open",
  "subscription_inactive",
  "subscription_payment_pending",
  "addon_payment_failed",
  "addon_required",
  "project_required_for_addon",
  "project_required_for_edit",
]);

export function messageForTicketSubmitError(err: unknown): string {
  const fallback = "Could not submit the ticket. Please try again.";
  if (err instanceof ApiRequestError && err.code && ADDON_TICKET_ERROR_CODES.has(err.code)) {
    const msg = err.message.trim();
    if (msg && !msg.includes("_")) return msg;
    const friendly: Record<string, string> = {
      addon_not_owned: "This add-on is not on the selected project.",
      addon_already_utilized:
        "This add-on is not available for a new request in the current billing cycle.",
      addon_ticket_already_open: "You already have an open request for this add-on.",
      subscription_inactive: "An active subscription is required for add-on requests.",
      subscription_payment_pending: "Resolve subscription billing before opening an add-on request.",
      addon_payment_failed: "The latest add-on payment failed. Update billing first.",
      addon_required: "Select an add-on for this request.",
      project_required_for_addon: "Select a project for add-on requests.",
      project_required_for_edit: "Select a project for website edit requests.",
    };
    return friendly[err.code] ?? fallback;
  }
  if (
    err instanceof ApiRequestError &&
    (err.code === "file_too_large" || err.code === "too_many_files")
  ) {
    const msg = err.message.trim();
    if (msg && !msg.includes("_")) return msg;
  }
  if (err instanceof ApiRequestError && err.code === "insufficient_credits") {
    const { needed, available } = err;
    if (typeof needed === "number" && typeof available === "number") {
      const creditWord = needed === 1 ? "credit" : "credits";
      const availVerb = available === 1 ? "is" : "are";
      return `This edit requires ${needed} website edit ${creditWord}, but only ${available} ${availVerb} available on this project. Buy more credits from your project dashboard.`;
    }
    const msg = err.message.trim();
    if (msg && !msg.includes("_")) return msg;
    return "Not enough website edit credits on this project. Buy more credits from your project dashboard.";
  }
  return userFacingApiError(err, fallback);
}

export function fetchTickets() {
  return api<SupportTicket[]>("/api/support/tickets");
}

export function fetchTicketById(id: string) {
  return api<SupportTicketDetail>(`/api/support/tickets/${id}`);
}

export function fetchSupportEditTypes() {
  return api<SupportEditType[]>("/api/support/edit-types");
}

export function fetchAddonTicketOptions(projectId: string) {
  return api<{ addons: AddonTicketOption[]; subscriptionActive: boolean }>(
    `/api/support/projects/${encodeURIComponent(projectId)}/addon-ticket-options`,
  );
}

export function postTicketReply(id: string, body: string) {
  return api<{ id: string; createdAt: string }>(`/api/support/tickets/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function closeSupportTicket(id: string) {
  return api<{ id: string; status: string; updatedAt: string; creditsRefunded?: boolean }>(
    `/api/support/tickets/${id}/close`,
    { method: "POST" },
  );
}

export function reopenSupportTicket(id: string) {
  return api<{ id: string; status: string; updatedAt: string; creditsRefunded?: boolean }>(
    `/api/support/tickets/${id}/reopen`,
    { method: "POST" },
  );
}

/** Refreshes admin ticket list cache after detail mutations. */
export async function refreshAdminTicketsList(limit = 100) {
  return fetchAdminTickets({ limit });
}

export function deleteSupportTicket(id: string) {
  return api<void>(`/api/support/tickets/${id}`, { method: "DELETE" });
}

export function createTicket(input: CreateTicketInput) {
  const hasAttachments = Array.isArray(input.attachments) && input.attachments.length > 0;
  if (hasAttachments) {
    const form = new FormData();
    form.set("subject", input.subject);
    form.set("description", input.description);
    if (input.departmentId) form.set("departmentId", input.departmentId);
    if (input.priority) form.set("priority", input.priority);
    if (input.ticketCategory) form.set("ticketCategory", input.ticketCategory);
    if (input.projectId?.trim()) {
      form.set("projectId", input.projectId.trim());
      if (input.editTypeId?.trim()) form.set("editTypeId", input.editTypeId.trim());
      if (input.subscriptionAddonId?.trim()) form.set("subscriptionAddonId", input.subscriptionAddonId.trim());
    }
    for (const file of input.attachments ?? []) {
      form.append("attachments", file);
    }
    return api<SupportTicket>("/api/support/tickets", {
      method: "POST",
      body: form,
    });
  }
  return api<SupportTicket>("/api/support/tickets", {
    method: "POST",
    body: JSON.stringify({
      subject: input.subject,
      description: input.description,
      departmentId: input.departmentId,
      priority: input.priority,
      ...(input.ticketCategory ? { ticketCategory: input.ticketCategory } : {}),
      ...(input.projectId?.trim()
        ? {
            projectId: input.projectId.trim(),
            ...(input.editTypeId?.trim() ? { editTypeId: input.editTypeId.trim() } : {}),
            ...(input.subscriptionAddonId?.trim()
              ? { subscriptionAddonId: input.subscriptionAddonId.trim() }
              : {}),
          }
        : {}),
    }),
  });
}

export function fetchKBCategories() {
  return api<KBCategory[]>("/api/support/kb/categories");
}

export function fetchKBArticles(categoryId?: string) {
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
  return api<KBArticle[]>(`/api/support/kb/articles${query}`);
}

export function fetchKBArticleById(id: string) {
  return api<KBArticle>(`/api/support/kb/articles/${id}`);
}

/* Admin support */

export function fetchAdminTickets(params?: {
  status?: string;
  priority?: string;
  /** general | non_general (edit + add-on tickets) */
  categoryScope?: AdminTicketCategoryScope;
  offset?: number;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.priority) q.set("priority", params.priority);
  if (params?.categoryScope) q.set("categoryScope", params.categoryScope);
  if (params?.offset != null) q.set("offset", String(params.offset));
  if (params?.limit != null) q.set("limit", String(params.limit));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return api<{ items: AdminSupportTicketListItem[]; total: number; take: number; skip: number }>(
    `/api/admin/tickets${suffix}`,
  );
}

export function fetchAdminTicketById(id: string) {
  return api<SupportTicketDetail & { user: { id: string; name: string; email: string } }>(`/api/admin/tickets/${id}`);
}

export function postAdminTicketReply(id: string, body: string) {
  return api<{ id: string; createdAt: string; status: string }>(`/api/admin/tickets/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function patchAdminTicketStatus(id: string, status: TicketStatus, workCompleted?: boolean) {
  const body: { status: TicketStatus; workCompleted?: boolean } = { status };
  if (workCompleted !== undefined) body.workCompleted = workCompleted;
  return api<{ id: string; status: string; updatedAt: string; creditsRefunded?: boolean; workCompleted?: boolean | null }>(
    `/api/admin/tickets/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function downloadTicketAttachment(downloadUrl: string, fileName: string) {
  const blob = await apiBlob(downloadUrl);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
