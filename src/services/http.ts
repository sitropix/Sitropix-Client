// Empty = same-origin "/api" (Vite dev proxy). Set full origin in production if API is on another host.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const ACCESS_TOKEN_KEY = "portal_access_token";

/** Thrown by `api()` when `!res.ok` so callers can branch on HTTP status. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly moduleKey?: string;
  /** Present when server returns Zod `flatten()` from validation middleware. */
  readonly issues?: unknown;
  /** Website edit credit shortfall (`insufficient_credits` on ticket create). */
  readonly needed?: number;
  readonly available?: number;
  constructor(
    message: string,
    status: number,
    code?: string,
    moduleKey?: string,
    issues?: unknown,
    extras?: { needed?: number; available?: number },
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.moduleKey = moduleKey;
    this.issues = issues;
    this.needed = extras?.needed;
    this.available = extras?.available;
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "manager" | "admin" | "master_admin" | "support";
  isEmailVerified?: boolean;
  phoneNumber?: string | null;
  hasLoggedIn?: boolean;
  uiPrefs?: Record<string, unknown>;
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
  const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const doFetch = async (bearer?: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
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
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      moduleKey?: string;
      issues?: unknown;
      needed?: number;
      available?: number;
    };
    throw new ApiRequestError(
      body.message ?? body.error ?? "request_failed",
      res.status,
      body.error,
      body.moduleKey,
      body.issues,
      { needed: body.needed, available: body.available },
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function apiBlob(path: string, init?: RequestInit): Promise<Blob> {
  const token = getAccessToken();
  const doFetch = async (bearer?: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
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
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      moduleKey?: string;
      issues?: unknown;
    };
    throw new ApiRequestError(
      body.message ?? body.error ?? "request_failed",
      res.status,
      body.error,
      body.moduleKey,
      body.issues,
    );
  }
  return res.blob();
}

export function isModuleForbiddenError(err: unknown): err is ApiRequestError {
  return err instanceof ApiRequestError && err.status === 403 && err.code === "module_forbidden";
}

const GENERIC_API_MESSAGES = new Set(
  ["request_failed", "internal_server_error", "Unexpected server error."].map((s) => s.toLowerCase()),
);

/** Prefer stable, readable copy over generic or internal API error text. */
export function userFacingApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiRequestError) {
    if (err.status >= 500) return fallback;
    if (err.status === 401) return "Your session expired. Please sign in again.";
    const raw = err.message.trim();
    if (raw && !GENERIC_API_MESSAGES.has(raw.toLowerCase())) return raw;
    return fallback;
  }
  if (err instanceof TypeError && /fetch|network|load failed/i.test(err.message)) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return fallback;
}
