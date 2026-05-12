import type {
  AdminSupportTicketListItem,
  CreateTicketInput,
  KBArticle,
  KBCategory,
  SupportTicket,
  SupportTicketDetail,
  TicketStatus,
} from "@/types/support";
import { api, apiBlob } from "@/services/http";

export function fetchTickets() {
  return api<SupportTicket[]>("/api/support/tickets");
}

export function fetchTicketById(id: string) {
  return api<SupportTicketDetail>(`/api/support/tickets/${id}`);
}

export function postTicketReply(id: string, body: string) {
  return api<{ id: string; createdAt: string }>(`/api/support/tickets/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function createTicket(input: CreateTicketInput) {
  const hasAttachments = Array.isArray(input.attachments) && input.attachments.length > 0;
  if (hasAttachments) {
    const form = new FormData();
    form.set("subject", input.subject);
    form.set("description", input.description);
    if (input.departmentId) form.set("departmentId", input.departmentId);
    if (input.priority) form.set("priority", input.priority);
    if (input.projectId?.trim()) form.set("projectId", input.projectId.trim());
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
      ...(input.projectId?.trim() ? { projectId: input.projectId.trim() } : {}),
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

export function fetchAdminTickets(params?: { status?: string; offset?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
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

export function patchAdminTicketStatus(id: string, status: TicketStatus) {
  return api<{ id: string; status: string; updatedAt: string }>(`/api/admin/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
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
