import { Link } from "react-router-dom";
import type { ProjectWorkflowSnapshot } from "@/types/projectWorkflow";
import type { ProjectRecord } from "@/types/project";

/**
 * Top-of-dashboard banner shown when a Stripe Checkout session was started but
 * payment was never completed. Lets the customer resume where they left off.
 */
export function PendingCheckoutBanner(props: {
  project: ProjectRecord;
  snapshot: ProjectWorkflowSnapshot | null;
}) {
  const pending = props.snapshot?.pendingCheckoutSessionId ?? null;
  if (!pending) return null;
  if (props.project.subscriptionStatus === "active") return null;

  const sinceLabel = props.snapshot?.pendingCheckoutSessionAt
    ? `Started ${new Date(props.snapshot.pendingCheckoutSessionAt).toLocaleDateString()}`
    : null;

  return (
    <div className="flex flex-col gap-3 rounded-sx-lg border-2 border-[var(--color-warning-500)]/40 bg-[var(--color-warning-bg)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-display text-sx-md font-semibold text-[var(--color-warning-fg)]">
          Finish your payment to start your build
        </p>
        <p className="mt-0.5 text-sx-sm text-[var(--color-warning-fg)]/80">
          Your checkout was started but never completed. {sinceLabel ?? ""}
        </p>
      </div>
      <Link
        to={`/projects/${encodeURIComponent(props.project.id)}/subscription`}
        className="inline-flex h-[40px] shrink-0 items-center justify-center rounded-sx-md bg-[var(--color-warning-500)] px-5 font-ui text-sx-sm font-semibold text-white hover:opacity-90"
      >
        Resume payment →
      </Link>
    </div>
  );
}
