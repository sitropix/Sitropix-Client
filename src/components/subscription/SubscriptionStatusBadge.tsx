import type { SubscriptionStatus } from "@/types/subscription";

const styles: Record<SubscriptionStatus, string> = {
  active: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300",
  trialing: "bg-sky-100 text-sky-700 ring-1 ring-sky-300",
  paused: "bg-amber-100 text-amber-700 ring-1 ring-amber-300",
  canceled: "bg-rose-100 text-rose-700 ring-1 ring-rose-300",
  past_due: "bg-orange-100 text-orange-700 ring-1 ring-orange-300",
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}
