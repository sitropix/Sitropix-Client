import type {
  AdminSupportTicketListItem,
  CreateTicketInput,
  KBArticle,
  KBCategory,
  SupportTicket,
  SupportTicketDetail,
} from "@/types/support";
import { api } from "@/services/http";

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
  return api<SupportTicket>("/api/support/tickets", {
    method: "POST",
    body: JSON.stringify(input),
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

export function patchAdminTicketStatus(id: string, status: "open" | "in_progress" | "resolved") {
  return api<{ id: string; status: string; updatedAt: string }>(`/api/admin/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
