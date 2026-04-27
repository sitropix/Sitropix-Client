import { api, type AuthUser } from "@/services/http";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export function verifyEmailWithToken(token: string) {
  return api<{ ok: boolean }>("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function requestPasswordReset(email: string) {
  return api<{ ok: boolean }>("/api/auth/request-password-reset", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export interface InviteInfoResponse {
  email: string;
  planId: string | null;
  planName: string | null;
  planCode: string | null;
  message: string;
  expiresAt: string;
}

export async function fetchInviteInfo(token: string): Promise<InviteInfoResponse> {
  const res = await fetch(`${API_BASE}/api/auth/invite-info?token=${encodeURIComponent(token)}`);
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "invite_invalid");
  return body as InviteInfoResponse;
}

export function resetPasswordWithToken(token: string, newPassword: string) {
  return api<{ ok: boolean }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export function patchProfile(payload: { email?: string; phoneNumber?: string }) {
  return api<{ accessToken?: string; user: AuthUser }>("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
