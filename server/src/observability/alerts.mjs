import { env } from "../config/env.mjs";
import { log } from "./logger.mjs";

let lastAlertAt = 0;
let lastType = "";
const DEDUPE_MS = 60_000;

/**
 * Fire-and-forget POST to ALERT_WEBHOOK_URL (Slack, Discord, custom endpoint).
 * Dedupes identical bursts to reduce noise.
 */
export async function sendAlert({ event, requestId, detail }) {
  const url = String(env.alertWebhookUrl || "").trim();
  if (!url) return;
  if (!env.alertingEnabled) return;
  const now = Date.now();
  if (now - lastAlertAt < DEDUPE_MS && event === lastType) {
    return;
  }
  lastType = event;
  lastAlertAt = now;
  const body = {
    source: "sitropix-portal-api",
    event,
    at: new Date().toISOString(),
    requestId: requestId ?? null,
    env: env.nodeEnv,
    detail: detail ?? null,
  };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const resW = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "sitropix-portal-alerts/1",
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!resW.ok) {
      log.warn("alert.webhook_not_ok", { status: resW.status, event });
    }
  } catch (e) {
    log.warn("alert.webhook_post_failed", { event, error: e?.message });
  } finally {
    clearTimeout(t);
  }
}

export function clearAlertDedupeForTests() {
  lastAlertAt = 0;
  lastType = "";
}

/**
 * @param {string} type
 * @param {{ requestId?: string, detail?: Record<string, unknown> }} o
 */
export function sendCriticalAlert(type, o = {}) {
  if (!String(env.alertWebhookUrl || "").trim()) return;
  return sendAlert({ event: type, requestId: o.requestId, detail: o.detail });
}
