import type { TicketStatus } from "@/types/support";

const styles: Record<TicketStatus, string> = {
  open: "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/25",
  in_progress: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/25",
  resolved: "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20",
};

const labels: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
