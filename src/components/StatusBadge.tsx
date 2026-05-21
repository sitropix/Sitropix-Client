import type { TicketStatus } from "@/types/support";

const darkStyles: Record<TicketStatus, string> = {
  open: "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/25",
  in_progress: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/25",
  hold: "bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/25",
  resolved: "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20",
  closed: "bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-400/25",
};

const portalStyles: Record<TicketStatus, string> = {
  open: "border border-sky-300 bg-sky-100 text-sky-900 ring-0",
  in_progress: "border border-amber-300 bg-amber-100 text-amber-950 ring-0",
  hold: "border border-violet-300 bg-violet-100 text-violet-900 ring-0",
  resolved: "border border-emerald-300 bg-emerald-100 text-emerald-900 ring-0",
  closed: "border border-zinc-400 bg-zinc-200 text-zinc-800 ring-0",
};

const labels: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  hold: "Hold",
  resolved: "Resolved",
  closed: "Closed",
};

export function StatusBadge({
  status,
  variant = "portal",
}: {
  status: TicketStatus;
  /** `portal` = light client portal; `dark` = admin / legacy dark panels */
  variant?: "portal" | "dark";
}) {
  const palette = variant === "dark" ? darkStyles : portalStyles;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${palette[status]}`}
    >
      {labels[status]}
    </span>
  );
}
