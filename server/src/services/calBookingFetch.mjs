import { env } from "../config/env.mjs";
import { log } from "../observability/logger.mjs";

/**
 * Fetch booking details from Cal.com API v2 (used server-side with CAL_API_KEY).
 * @param {string} bookingUid
 * @returns {Promise<{ ok: boolean, status?: number, body?: unknown, meetingUrl?: string | null, startTime?: string | null }>}
 */
export async function fetchCalBookingByUid(bookingUid) {
  const uid = String(bookingUid || "").trim();
  const apiKey = String(env.calApiKey || "").trim();
  if (!uid || !apiKey) {
    return { ok: false, status: 0, body: null };
  }

  const apiVersion = String(env.calApiVersion || "2024-08-13").trim();
  const url = `https://api.cal.com/v2/bookings/${encodeURIComponent(uid)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": apiVersion,
        Accept: "application/json",
      },
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _raw: text };
    }

    if (!res.ok) {
      log.warn("cal.booking_fetch_failed", { status: res.status, uid: uid.slice(0, 12) });
      return { ok: false, status: res.status, body: json };
    }

    const meetingUrl = pickMeetingUrl(json);
    const startTime = pickStartTime(json);

    return { ok: true, status: res.status, body: json, meetingUrl, startTime };
  } catch (e) {
    log.warn("cal.booking_fetch_error", { message: e?.message });
    return { ok: false, status: 0, body: { error: String(e?.message ?? "fetch_error") } };
  }
}

function pickMeetingUrl(body) {
  const data = unwrapData(body);
  const candidates = [
    data?.meetingUrl,
    data?.videoCallUrl,
    data?.location,
    data?.metadata?.videoCallUrl,
    data?.videoCallData?.url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("http")) return c;
  }
  return null;
}

function pickStartTime(body) {
  const data = unwrapData(body);
  const s = data?.start ?? data?.startTime ?? data?.start_time;
  return typeof s === "string" ? s : null;
}

function unwrapData(body) {
  if (!body || typeof body !== "object") return null;
  const b = body;
  if (b.data && typeof b.data === "object" && !Array.isArray(b.data)) return b.data;
  return b;
}
