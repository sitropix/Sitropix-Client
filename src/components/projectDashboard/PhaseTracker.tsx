import type { ProjectWorkflowStatus } from "@/types/projectWorkflow";

const LINEAR_PHASES: Array<{ key: ProjectWorkflowStatus; label: string }> = [
  { key: "awaiting_brief", label: "Brief" },
  { key: "awaiting_assets", label: "Assets" },
  { key: "ready_to_start", label: "Ready" },
  { key: "in_progress", label: "Build" },
  { key: "in_review", label: "Review" },
  { key: "approved", label: "Approved" },
  { key: "live", label: "Live" },
];

const OFF_PHASE_LABEL: Partial<Record<ProjectWorkflowStatus, string>> = {
  awaiting_customer_reply: "Waiting on you",
  revisions_requested: "Revisions in flight",
  on_hold: "On hold",
};

export function PhaseTracker(props: {
  status: ProjectWorkflowStatus;
  progressPercent: number;
}) {
  const { status, progressPercent } = props;
  const currentIdx = LINEAR_PHASES.findIndex((p) => p.key === status);
  const offPhaseNote = OFF_PHASE_LABEL[status];

  return (
    <div className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-sx-md font-semibold text-[var(--text-primary)]">Project phase</h2>
        <span className="font-mono text-sx-2xs text-[var(--text-tertiary)]">{progressPercent}% complete</span>
      </div>
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
        <div
          className="h-full rounded-full bg-[var(--color-brand-500)] transition-[width] duration-500"
          style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
          aria-hidden="true"
        />
      </div>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {LINEAR_PHASES.map((phase, i) => {
          const isPast = currentIdx >= 0 && i < currentIdx;
          const isCurrent = phase.key === status;
          const dotColor = isCurrent
            ? "bg-[var(--color-brand-500)] ring-4 ring-[var(--color-brand-100)]"
            : isPast
              ? "bg-[var(--color-success-500)]"
              : "bg-[var(--surface-sunken)] border border-[var(--border-subtle)]";
          return (
            <li key={phase.key} className="flex items-center gap-2">
              <span className={`block size-3 rounded-full ${dotColor}`} aria-hidden="true" />
              <span
                className={`font-mono text-sx-2xs uppercase tracking-wider ${
                  isCurrent
                    ? "text-[var(--text-primary)] font-semibold"
                    : isPast
                      ? "text-[var(--text-secondary)]"
                      : "text-[var(--text-tertiary)]"
                }`}
              >
                {phase.label}
              </span>
              {i < LINEAR_PHASES.length - 1 ? (
                <span className="hidden h-px w-4 bg-[var(--border-subtle)] sm:inline-block" aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>
      {offPhaseNote ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--color-warning-bg)] px-3 py-1 text-sx-xs text-[var(--color-warning-fg)]">
          ⚠ {offPhaseNote}
        </p>
      ) : null}
    </div>
  );
}
