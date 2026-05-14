/**
 * Support ticket priority from project plan + optional priority-boost add-on.
 * Starter → low, Growth → medium, Pro → high.
 * Active boost (until subscription.supportPriorityBoostUntil) forces high for that project.
 */

/** @param {string | null | undefined} planCode */
export function basePriorityFromPlanCode(planCode) {
  const c = String(planCode ?? "").toLowerCase();
  if (c.includes("pro")) return "high";
  if (c.includes("growth")) return "medium";
  return "low";
}

/**
 * @param {{ planCode?: string | null; boostUntil?: Date | string | null; now?: Date }} p
 * @returns {"low" | "medium" | "high"}
 */
export function resolveSupportTicketPriority({ planCode, boostUntil, now = new Date() }) {
  if (boostUntil) {
    const t = boostUntil instanceof Date ? boostUntil : new Date(boostUntil);
    if (!Number.isNaN(t.getTime()) && t.getTime() > now.getTime()) return "high";
  }
  return basePriorityFromPlanCode(planCode);
}
