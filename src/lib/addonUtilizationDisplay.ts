import type { ProjectAddonFulfillment, ProjectAddonFulfillmentStatus } from "@/types/project";
import type { AddonTicketOption } from "@/types/support";

export function addonFulfillmentStatusLabel(status: ProjectAddonFulfillmentStatus): string {
  switch (status) {
    case "not_used":
      return "Not Used";
    case "in_progress":
      return "In Progress";
    case "setup_completed":
      return "Setup Completed";
    default:
      return status;
  }
}

export function addonFulfillmentBadgeClass(status: ProjectAddonFulfillmentStatus): string {
  switch (status) {
    case "not_used":
      return "bg-surface-container text-on-surface-variant";
    case "in_progress":
      return "bg-info-bg text-info";
    case "setup_completed":
      return "bg-success-bg text-success";
    default:
      return "bg-surface-container text-on-surface-variant";
  }
}

export function addonFulfillmentCaption(
  fulfillment: ProjectAddonFulfillment,
  projectId: string,
): string {
  if (fulfillment.status === "setup_completed") {
    return "Our team marked this add-on setup as completed.";
  }
  if (fulfillment.status === "in_progress") {
    const subject = fulfillment.activeTicketSubject?.trim();
    return subject
      ? `Support request in progress: ${subject}`
      : "You have an open support request for this add-on.";
  }
  return "Purchased — open a support request when you are ready for us to start.";
}

export function submitTicketUrlForAddon(projectId: string, subscriptionAddonId: string): string {
  const params = new URLSearchParams({
    category: "addon",
    projectId,
    subscriptionAddonId,
  });
  return `/ticket?${params.toString()}`;
}

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
