import type { TicketStatus } from "@/types/support";

const styles: Record<TicketStatus, string> = {
  open: "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/25",
  in_progress: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/25",
  hold: "bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/25",
  resolved: "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20",
  closed: "bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-400/25",
};

const labels: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  hold: "Hold",
  resolved: "Resolved",
  closed: "Closed",
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
