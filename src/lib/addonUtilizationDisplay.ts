import type { AddonTicketOption } from "@/types/support";

export function formatAddonRecurringLabel(option: AddonTicketOption): string {
  if (option.recurringType === "one_time") return "One-time";
  if (option.recurringType === "yearly") return "Yearly recurring";
  return "Monthly recurring";
}

export function formatAddonCycleWindow(option: AddonTicketOption): string | null {
  if (!option.currentCycleStart || !option.currentCycleEnd) return null;
  const start = new Date(option.currentCycleStart).toLocaleDateString();
  const end = new Date(option.currentCycleEnd).toLocaleDateString();
  return `Current cycle: ${start} – ${end}`;
}

export function addonTicketOptionHint(option: AddonTicketOption): string {
  if (!option.eligible && option.ineligibleMessage) return option.ineligibleMessage;
  if (option.isUtilized) return "Already used this billing cycle.";
  if (option.isBundled) return "Included with your plan.";
  const cycle = formatAddonCycleWindow(option);
  return cycle ?? "Eligible for a support request this cycle.";
}
