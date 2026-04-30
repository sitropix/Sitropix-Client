import type {
  AdminInviteRow,
  AuditLogListPayload,
  AuditLogSummary,
  AdminUserRow,
  AnalyticsSummary,
  BillingCycle,
  ClientDocumentRow,
  CrmLeadDetailPayload,
  CustomerPortalPayload,
  EmailProviderId,
  EmailSettingsPayload,
  FormDefinitionDetail,
  FormDefinitionListItem,
  FormEmbedPayload,
  CrmLeadListItem,
  FormFieldRow,
  CrmLeadStatus,
  SystemConfigPayload,
  FeatureFlagsAdminPayload,
  Plan,
  Subscription,
  AdminCustomerProfilePayload,
} from "@/types/subscription";
import { api, getAccessToken } from "@/services/http";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export function fetchCustomerPortal() {
  return api<CustomerPortalPayload>("/api/subscriptions/portal");
}

/** Reconcile local subscription row from Stripe (no webhooks required). */
export function syncFromStripe() {
  return api<{
    ok: boolean;
    reason?: string;
    planCode?: string;
    stripeSubscriptionId?: string;
    error?: string;
    detail?: { priceId: string | null };
  }>("/api/subscriptions/sync-stripe", { method: "POST", body: JSON.stringify({}) });
}

export function bootstrapSubscription(planId: string, billingCycle: BillingCycle) {
  return api<Subscription>("/api/subscriptions/bootstrap", {
    method: "POST",
    body: JSON.stringify({ planId, billingCycle }),
  });
}

export function changePlan(planId: string, billingCycle: BillingCycle) {
  return api<{ subscription: Subscription; proration: { netCents: number } }>("/api/subscriptions/change-plan", {
    method: "POST",
    body: JSON.stringify({ planId, billingCycle }),
  });
}

export function cancelSubscription() {
  return api<Subscription>("/api/subscriptions/cancel", { method: "POST", body: JSON.stringify({}) });
}

export function pauseSubscription() {
  return api<Subscription>("/api/subscriptions/pause", { method: "POST", body: JSON.stringify({}) });
}

export function resumeSubscription() {
  return api<Subscription>("/api/subscriptions/resume", { method: "POST", body: JSON.stringify({}) });
}

export function upsertPaymentMethod(payload: { brand: string; last4: string; expMonth: number; expYear: number }) {
  return api("/api/subscriptions/payment-method", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminPlans() {
  return api<Plan[]>("/api/admin/plans");
}

export function createAdminPlan(payload: Partial<Plan>) {
  return api<Plan>("/api/admin/plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminPlan(id: string, payload: Partial<Plan>) {
  return api<Plan>(`/api/admin/plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminPlan(id: string) {
  return api<{ ok: boolean }>(`/api/admin/plans/${id}`, { method: "DELETE" });
}

export function fetchAdminSubscriptions() {
  return api<Subscription[]>("/api/admin/subscriptions");
}

export function updateAdminSubscription(id: string, payload: Record<string, unknown>) {
  return api<Subscription>(`/api/admin/subscriptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function createCoupon(payload: {
  code: string;
  discountType: "percent" | "flat";
  discountValue: number;
  maxRedemptions?: number;
  expiresAt?: string;
}) {
  return api("/api/admin/coupons", { method: "POST", body: JSON.stringify(payload) });
}

export function fetchTransactions() {
  return api<Array<{ id: string; amountCents: number; status: string; invoiceNumber: string; failureReason?: string | null }>>(
    "/api/admin/transactions",
  );
}

export function retryFailedPayment(id: string) {
  return api(`/api/admin/payments/${id}/retry`, { method: "POST", body: JSON.stringify({}) });
}

export function fetchAnalytics() {
  return api<AnalyticsSummary>("/api/admin/analytics");
}

export function fetchAdminAuditLogs(params?: {
  action?: string;
  targetType?: string;
  actorUserId?: string;
  limit?: number;
  page?: number;
  startAt?: string;
  endAt?: string;
}) {
  const q = new URLSearchParams();
  if (params?.action) q.set("action", params.action);
  if (params?.targetType) q.set("targetType", params.targetType);
  if (params?.actorUserId) q.set("actorUserId", params.actorUserId);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.page) q.set("page", String(params.page));
  if (params?.startAt) q.set("startAt", params.startAt);
  if (params?.endAt) q.set("endAt", params.endAt);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return api<AuditLogListPayload>(`/api/admin/audit-logs${suffix}`);
}

export function fetchAdminAuditSummary() {
  return api<AuditLogSummary>("/api/admin/audit-logs/summary");
}

export async function downloadAdminAuditLogsCsv(params?: {
  action?: string;
  targetType?: string;
  actorUserId?: string;
  startAt?: string;
  endAt?: string;
}) {
  const q = new URLSearchParams();
  if (params?.action) q.set("action", params.action);
  if (params?.targetType) q.set("targetType", params.targetType);
  if (params?.actorUserId) q.set("actorUserId", params.actorUserId);
  if (params?.startAt) q.set("startAt", params.startAt);
  if (params?.endAt) q.set("endAt", params.endAt);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api/admin/audit-logs/export.csv${suffix}`, {
    method: "GET",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("audit_export_failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "audit_logs.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function fetchAdminEmailSettings() {
  return api<EmailSettingsPayload>("/api/admin/email-settings");
}

export function saveAdminEmailSettings(payload: {
  provider: EmailProviderId;
  fromEmail: string;
  fromName?: string;
  settings?: Record<string, unknown>;
  secrets?: Record<string, string>;
}) {
  return api<EmailSettingsPayload>("/api/admin/email-settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function clearAdminEmailSettings() {
  return api<EmailSettingsPayload & { ok: boolean }>("/api/admin/email-settings", {
    method: "DELETE",
    body: JSON.stringify({}),
  });
}

export function postAdminEmailTest(to?: string) {
  return api<{ ok: boolean; to: string }>("/api/admin/email-settings/test", {
    method: "POST",
    body: JSON.stringify(to ? { to } : {}),
  });
}

export function fetchAdminSystemConfig() {
  return api<SystemConfigPayload>("/api/admin/system-config");
}

export function saveAdminSystemConfig(items: Array<{ key: string; value: string; isSecret: boolean }>) {
  return api<SystemConfigPayload>("/api/admin/system-config", {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

export function testAdminSystemConfigDb() {
  return api<{ ok: boolean }>("/api/admin/system-config/test/db", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function testAdminSystemConfigStripe() {
  return api<{ ok: boolean }>("/api/admin/system-config/test/stripe", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function fetchFeatureFlagsAdmin() {
  return api<FeatureFlagsAdminPayload>("/api/admin/feature-flags");
}

export function patchAdminFeatureFlag(key: string, enabled: boolean) {
  return api<{ id: string; key: string; label: string; enabled: boolean }>(`/api/admin/feature-flags/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export function upsertPlanFeatureOverride(planId: string, key: string, enabled: boolean) {
  return api<{ id: string; planId: string; key: string; enabled: boolean }>(`/api/admin/plans/${planId}/feature-overrides`, {
    method: "POST",
    body: JSON.stringify({ key, enabled }),
  });
}

export function deletePlanFeatureOverride(planId: string, key: string) {
  return api<{ ok: boolean }>(`/api/admin/plans/${planId}/feature-overrides/${encodeURIComponent(key)}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
}

export function fetchAdminUsers() {
  return api<AdminUserRow[]>("/api/admin/users");
}

export function fetchAdminUserManagement() {
  return api<{
    users: Array<
      AdminUserRow & {
        status: "active" | "deactivated";
        moduleAccess?: Array<{ moduleKey: string; enabled: boolean }>;
      }
    >;
    invites: Array<{
      id: string;
      email: string;
      planId: string | null;
      createdAt: string;
      expiresAt: string;
      status: "invite_pending";
    }>;
  }>("/api/admin/user-management/users");
}

export function inviteAdminUser(payload: { name: string; email: string; role: string }) {
  return api<{ ok: boolean; id: string; email: string }>("/api/admin/user-management/invite", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function setAdminUserRole(userId: string, role: "user" | "manager" | "admin" | "master_admin" | "support") {
  return api<{ ok: boolean; id: string; role: string }>(`/api/admin/user-management/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function deactivateAdminUser(userId: string) {
  return api<{ ok: boolean }>(`/api/admin/user-management/users/${userId}/deactivate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function reactivateAdminUser(userId: string) {
  return api<{ ok: boolean }>(`/api/admin/user-management/users/${userId}/reactivate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function sendAdminUserResetLink(userId: string) {
  return api<{ ok: boolean }>(`/api/admin/user-management/users/${userId}/password-reset-link`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function setAdminUserPassword(userId: string, newPassword: string) {
  return api<{ ok: boolean }>(`/api/admin/user-management/users/${userId}/set-password`, {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  });
}

export function setAdminUserModuleAccess(userId: string, modules: Array<{ moduleKey: string; enabled: boolean }>) {
  return api<{ ok: boolean }>(`/api/admin/user-management/users/${userId}/module-access`, {
    method: "PUT",
    body: JSON.stringify({ modules }),
  });
}

export function fetchAdminCustomerProfile(userId: string) {
  return api<AdminCustomerProfilePayload>(`/api/admin/customers/${userId}/profile`);
}

export function fetchAdminCustomerDeletePreview(userId: string) {
  return api<{
    userId: string;
    email: string;
    counts: {
      subscriptions: number;
      payments: number;
      tickets: number;
      ticketMessages: number;
      documents: number;
      refreshTokens: number;
    };
  }>(`/api/admin/customers/${userId}/delete-preview`);
}

export function deactivateAdminCustomer(userId: string, reason?: string) {
  return api<{ ok: boolean }>(`/api/admin/customers/${userId}/deactivate`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export function reactivateAdminCustomer(userId: string) {
  return api<{ ok: boolean }>(`/api/admin/customers/${userId}/reactivate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function deleteAdminCustomer(userId: string, confirm: string) {
  return api<{ ok: boolean }>(`/api/admin/customers/${userId}`, {
    method: "DELETE",
    body: JSON.stringify({ confirm }),
  });
}

export function syncAdminCustomerStripe(userId: string) {
  return api<{
    ok: boolean;
    reason?: string;
    planCode?: string;
    stripeSubscriptionId?: string;
    error?: string;
  }>(`/api/admin/customers/${userId}/sync-stripe`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function fetchAdminInvites() {
  return api<AdminInviteRow[]>("/api/admin/invites");
}

export function createAdminInvite(payload: { email: string; planId?: string; message?: string; expiresInDays?: number }) {
  return api<{ ok: boolean; id: string; email: string; expiresAt: string }>("/api/admin/invites", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function revokeAdminInvite(id: string) {
  return api<{ ok: boolean }>(`/api/admin/invites/${id}`, { method: "DELETE", body: JSON.stringify({}) });
}

export function resendAdminInvite(id: string) {
  return api<{ ok: boolean; id: string; email: string }>(`/api/admin/invites/${id}/resend`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function adminTriggerPasswordReset(userId: string) {
  return api<{ ok: boolean }>(`/api/admin/users/${userId}/password-reset`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function adminTriggerCustomerPasswordReset(userId: string) {
  return api<{ ok: boolean }>(`/api/admin/customers/${userId}/password-reset`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function fetchMyDocuments() {
  return api<ClientDocumentRow[]>("/api/documents");
}

export async function downloadClientDocumentFile(documentId: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api/documents/${documentId}/download`, {
    method: "GET",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("download_failed");
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition");
  const match = cd?.match(/filename="([^"]+)"/);
  const name = match?.[1] ? decodeURIComponent(match[1]) : "document";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function adminUploadClientDocument(userId: string, file: File, title: string, category: string) {
  const token = getAccessToken();
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  form.append("category", category);
  const res = await fetch(`${API_BASE}/api/admin/users/${userId}/documents`, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "upload_failed");
  return body as ClientDocumentRow;
}

export function adminDeleteClientDocument(documentId: string) {
  return api<{ ok: boolean }>(`/api/admin/documents/${documentId}`, { method: "DELETE", body: JSON.stringify({}) });
}

export function fetchAdminUserDocuments(userId: string) {
  return api<ClientDocumentRow[]>(`/api/admin/users/${userId}/documents`);
}

export function createCheckoutSession(planId: string, billingCycle: BillingCycle) {
  return api<{ url: string }>("/api/subscriptions/checkout-session", {
    method: "POST",
    body: JSON.stringify({ planId, billingCycle }),
  });
}

export function createBillingPortalSession(returnUrl?: string) {
  return api<{ url: string }>("/api/subscriptions/billing-portal", {
    method: "POST",
    body: JSON.stringify(returnUrl ? { returnUrl } : {}),
  });
}

/** --- Forms (admin) --- */
export function fetchAdminForms() {
  return api<{ items: FormDefinitionListItem[] }>("/api/admin/forms");
}

export function fetchAdminFormDetail(formId: string) {
  return api<FormDefinitionDetail>(`/api/admin/forms/${formId}`);
}

export function fetchAdminFormEmbed(formId: string) {
  return api<FormEmbedPayload>(`/api/admin/forms/${formId}/embed`);
}

export function createAdminForm(payload: {
  name: string;
  slug: string;
  isActive?: boolean;
  settingsJson?: Record<string, unknown>;
  fields: Omit<FormFieldRow, "id">[];
}) {
  return api<FormDefinitionDetail>("/api/admin/forms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function patchAdminForm(formId: string, payload: Partial<{ name: string; slug: string; isActive: boolean; settingsJson: Record<string, unknown> }>) {
  return api<FormDefinitionDetail>(`/api/admin/forms/${formId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function replaceAdminFormFields(formId: string, fields: Omit<FormFieldRow, "id">[]) {
  return api<FormDefinitionDetail>(`/api/admin/forms/${formId}/fields`, {
    method: "PUT",
    body: JSON.stringify({ fields }),
  });
}

/** --- CRM (admin) --- */
export function fetchCrmLeads(params?: { status?: CrmLeadStatus; formId?: string; search?: string; limit?: number; offset?: number }) {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.formId) sp.set("formId", params.formId);
  if (params?.search?.trim()) sp.set("search", params.search.trim());
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.offset != null) sp.set("offset", String(params.offset));
  const q = sp.toString();
  return api<{ items: CrmLeadListItem[]; total: number }>(`/api/admin/crm/leads${q ? `?${q}` : ""}`);
}

export function fetchCrmLeadDetail(leadId: string) {
  return api<CrmLeadDetailPayload>(`/api/admin/crm/leads/${leadId}`);
}

export function patchCrmLeadStatus(
  leadId: string,
  payload: { toStatus: CrmLeadStatus; meetingLink?: string | null; reason?: string | null },
) {
  return api<{ id: string; status: CrmLeadStatus; meetingLink: string | null; meetingScheduledAt: string | null }>(
    `/api/admin/crm/leads/${leadId}/status`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export function convertCrmLead(leadId: string, payload?: { createUserIfNeeded?: boolean }) {
  return api<{
    ok: boolean;
    mode?: string;
    userId?: string;
    leadId?: string;
    note?: string;
    message?: string;
  }>(`/api/admin/crm/leads/${leadId}/convert`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}
