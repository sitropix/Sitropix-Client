import type { SubscriptionStatus } from "@/types/subscription";

const styles: Record<SubscriptionStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20",
  trialing: "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/25",
  paused: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/25",
  canceled: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/25",
  past_due: "bg-orange-500/15 text-orange-200 ring-1 ring-orange-400/25",
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}
