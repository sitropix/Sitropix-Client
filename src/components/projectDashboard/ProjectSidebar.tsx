import { Link } from "react-router-dom";
import { NotificationPrefsToggle } from "./NotificationPrefsToggle";
import { ShareLinkCard } from "./ShareLinkCard";
import type { ProjectRecord } from "@/types/project";
import type { ProjectWorkflowSnapshot } from "@/types/projectWorkflow";

function MetricRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">{props.label}</span>
      <span className="font-mono text-sx-sm font-semibold text-[var(--text-primary)]">{props.value}</span>
    </div>
  );
}

export function ProjectSidebar(props: {
  project: ProjectRecord;
  snapshot: ProjectWorkflowSnapshot | null;
  onSnapshotChanged: (next: ProjectWorkflowSnapshot) => void;
  onShareLinkChanged: () => void;
  isOwner: boolean;
}) {
  const { project, snapshot, onSnapshotChanged, onShareLinkChanged, isOwner } = props;
  const usage = project.usage ?? null;
  const includedRemaining = usage
    ? Math.max(0, usage.includedCreditsPerPeriod - usage.includedCreditsUsedThisPeriod)
    : 0;
  const renewalDays = project.planValidUntil
    ? Math.max(0, Math.ceil((new Date(project.planValidUntil).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <aside className="flex flex-col gap-4">
      <div className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
        <h3 className="font-display text-sx-sm font-semibold text-[var(--text-primary)]">Plan & credits</h3>
        <div className="mt-2 space-y-1">
          <MetricRow label="Plan" value={project.planName ?? "Not chosen"} />
          {usage ? (
            <>
              <MetricRow label="Included" value={`${includedRemaining} / ${usage.includedCreditsPerPeriod}`} />
              <MetricRow label="Purchased" value={String(usage.purchasedCreditsBalance)} />
            </>
          ) : null}
          {renewalDays !== null ? (
            <MetricRow
              label="Renews in"
              value={renewalDays === 0 ? "Today" : `${renewalDays} day${renewalDays === 1 ? "" : "s"}`}
            />
          ) : null}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Link
            to={`/projects/${encodeURIComponent(project.id)}/subscription`}
            className="inline-flex h-[34px] items-center justify-center rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 font-ui text-sx-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
          >
            Manage subscription
          </Link>
          <Link
            to={`/projects/${encodeURIComponent(project.id)}/add-ons`}
            className="inline-flex h-[34px] items-center justify-center rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 font-ui text-sx-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
          >
            Add-ons
          </Link>
          <Link
            to="/billing"
            className="inline-flex h-[34px] items-center justify-center rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 font-ui text-sx-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
          >
            Billing
          </Link>
        </div>
      </div>

      {project.addons.length > 0 ? (
        <div className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <h3 className="font-display text-sx-sm font-semibold text-[var(--text-primary)]">Add-ons attached</h3>
          <ul className="mt-2 space-y-1 text-sx-sm text-[var(--text-secondary)]">
            {project.addons.map((code) => (
              <li key={code} className="font-mono text-sx-xs">
                · {code}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isOwner && snapshot ? (
        <NotificationPrefsToggle
          projectId={project.id}
          snapshot={snapshot}
          onChanged={onSnapshotChanged}
        />
      ) : null}

      {snapshot ? (
        <ShareLinkCard
          projectId={project.id}
          snapshot={snapshot}
          onChanged={onShareLinkChanged}
        />
      ) : null}
    </aside>
  );
}
