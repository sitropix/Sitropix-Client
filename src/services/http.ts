// Empty = same-origin "/api" (Vite dev proxy). Set full origin in production if API is on another host.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const ACCESS_TOKEN_KEY = "portal_access_token";

/** Thrown by `api()` when `!res.ok` so callers can branch on HTTP status. */
export class ApiRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  isEmailVerified?: boolean;
}

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (!token) window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  else window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export async function refreshAccessToken() {
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken: string; user: AuthUser };
  setAccessToken(data.accessToken);
  return data;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const doFetch = async (bearer?: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(init?.headers ?? {}),
      },
    });

  let res = await doFetch(token ?? undefined);
  if (res.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed?.accessToken) res = await doFetch(refreshed.accessToken);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiRequestError(body.error ?? "request_failed", res.status);
  }
  return (await res.json()) as T;
}
