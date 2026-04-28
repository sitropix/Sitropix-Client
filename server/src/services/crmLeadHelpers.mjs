import crypto from "node:crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Accept HTTPS meeting URLs for Cal.com (and optionally Cal.com app host).
 */
export function isAllowedMeetingUrl(urlString) {
  try {
    const u = new URL(urlString.trim());
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return (
      host === "cal.com" ||
      host.endsWith(".cal.com") ||
      host === "app.cal.com" ||
      host.endsWith(".cal.dev")
    );
  } catch {
    return false;
  }
}

export function hashIp(ip) {
  const raw = String(ip || "unknown").slice(0, 120);
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 48);
}

/**
 * Pull common contact columns from typed fields + heuristic scan of string values.
 */
export function extractLeadContact(fields, answers) {
  const byKey = { ...answers };
  let email = null;
  let fullName = null;
  let phone = null;
  let company = null;

  for (const f of fields) {
    const v = byKey[f.key];
    if (v === undefined || v === null) continue;
    const s = typeof v === "string" ? v.trim() : String(v);
    if (!s) continue;
    const kl = f.key.toLowerCase();
    const tl = f.type?.toLowerCase() ?? "";
    if (tl === "email" || kl.includes("email")) email = email || s;
    if (tl === "tel" || tl === "phone" || kl.includes("phone") || kl.includes("mobile")) phone = phone || s;
    if (kl.includes("name") || tl === "text") {
      if (!fullName && (kl.includes("name") || f.label?.toLowerCase().includes("name"))) fullName = s;
    }
    if (kl.includes("company") || kl.includes("organization")) company = company || s;
  }

  if (!email) {
    for (const v of Object.values(byKey)) {
      if (typeof v === "string" && EMAIL_RE.test(v.trim())) {
        email = v.trim().toLowerCase();
        break;
      }
    }
  }

  if (!fullName) {
    for (const f of fields) {
      const kl = f.key.toLowerCase();
      if (kl === "name" || kl === "full_name" || kl === "fullname") {
        const v = byKey[f.key];
        if (typeof v === "string" && v.trim()) {
          fullName = v.trim();
          break;
        }
      }
    }
  }

  return {
    email: email ? email.toLowerCase() : null,
    fullName,
    phone,
    company,
  };
}
