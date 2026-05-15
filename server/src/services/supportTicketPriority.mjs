/**
 * Support ticket queue priority from plan `catalogJson.supportChannel` and optional priority-boost add-on.
 * Channels: email_48h → low, email_chat_24h → medium, priority_4h → high.
 * Active boost (until subscription.supportPriorityBoostUntil) forces high for that project.
 * Falls back to legacy plan-code heuristics when supportChannel is missing.
 */

/** @param {unknown} catalogJson */
export function priorityFromPlanSupportChannel(catalogJson) {
  const j = catalogJson && typeof catalogJson === "object" && !Array.isArray(catalogJson) ? catalogJson : {};
  const raw = j.supportChannel ?? j.support_channel;
  const c = String(raw ?? "").trim().toLowerCase();
  if (c === "email_chat_24h" || c === "email+chat_24h" || c.includes("email_chat")) return "medium";
  if (c === "priority_4h" || (c.includes("priority") && c.includes("4"))) return "high";
  if (c === "email_48h" || c === "email" || (c.includes("email") && c.includes("48"))) return "low";
  return null;
}

/** @param {string | null | undefined} planCode */
export function basePriorityFromPlanCode(planCode) {
  const c = String(planCode ?? "").toLowerCase();
  if (c.includes("pro")) return "high";
  if (c.includes("growth")) return "medium";
  return "low";
}

/**
 * @param {{
 *   planCode?: string | null;
 *   catalogJson?: unknown;
 *   boostUntil?: Date | string | null;
 *   now?: Date;
 * }} p
 * @returns {"low" | "medium" | "high"}
 */
export function resolveSupportTicketPriority({ planCode, catalogJson, boostUntil, now = new Date() }) {
  if (boostUntil) {
    const t = boostUntil instanceof Date ? boostUntil : new Date(boostUntil);
    if (!Number.isNaN(t.getTime()) && t.getTime() > now.getTime()) return "high";
  }
  const fromChannel = priorityFromPlanSupportChannel(catalogJson);
  if (fromChannel) return fromChannel;
  return basePriorityFromPlanCode(planCode);
}
