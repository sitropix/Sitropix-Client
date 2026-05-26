import { Link } from "react-router-dom";
import type { ProjectWorkflowSnapshot } from "@/types/projectWorkflow";

/** Staff-only sidebar panel showing customer info + quick links into admin tooling. */
export function CustomerContextPanel(props: {
  snapshot: ProjectWorkflowSnapshot | null;
  customerId: string;
}) {
  const owner = props.snapshot?.owner ?? null;
  return (
    <div className="rounded-sx-lg border border-[var(--color-brand-500)]/30 bg-[var(--color-brand-50)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sx-sm font-semibold text-[var(--text-primary)]">Customer</h3>
        <span className="rounded-full bg-[var(--color-brand-500)] px-2 py-0.5 font-mono text-sx-2xs uppercase tracking-wider text-white">
          Staff view
        </span>
      </div>
      {owner ? (
        <dl className="mt-3 space-y-1.5">
          <div>
            <dt className="font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">Name</dt>
            <dd className="text-sx-sm font-semibold text-[var(--text-primary)]">{owner.name}</dd>
          </div>
          <div>
            <dt className="font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">Email</dt>
            <dd className="break-all font-mono text-sx-xs text-[var(--text-secondary)]">
              <a className="hover:underline" href={`mailto:${owner.email}`}>{owner.email}</a>
            </dd>
          </div>
          {owner.phoneNumber ? (
            <div>
              <dt className="font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">Phone</dt>
              <dd className="font-mono text-sx-xs text-[var(--text-secondary)]">{owner.phoneNumber}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="mt-2 text-sx-xs text-[var(--text-tertiary)]">Customer info unavailable.</p>
      )}
      <div className="mt-3 flex flex-col gap-2">
        <Link
          to={`/admin/customers?userId=${encodeURIComponent(props.customerId)}`}
          className="inline-flex h-[34px] items-center justify-center rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 font-ui text-sx-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
        >
          Open in customer manager
        </Link>
      </div>
    </div>
  );
}
