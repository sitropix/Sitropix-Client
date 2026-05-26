import { SxBadge } from "@/components/sx/Badge";
import type { ProjectWorkflowSnapshot } from "@/types/projectWorkflow";
import type { ProjectRecord } from "@/types/project";

function workflowBadge(status: string): { variant: "success" | "warning" | "neutral"; label: string } {
  if (status === "live") return { variant: "success", label: "Live" };
  if (status === "on_hold") return { variant: "warning", label: "On hold" };
  if (status === "awaiting_customer_reply") return { variant: "warning", label: "Waiting on you" };
  if (status === "in_review") return { variant: "warning", label: "In review" };
  if (status === "approved") return { variant: "success", label: "Approved" };
  return { variant: "neutral", label: status.replace(/_/g, " ") };
}

export function ProjectHeader(props: {
  project: ProjectRecord;
  snapshot: ProjectWorkflowSnapshot | null;
}) {
  const { project, snapshot } = props;
  const badge = workflowBadge(snapshot?.workflowStatus ?? "awaiting_brief");
  const designerName = snapshot?.assignedDesigner?.name ?? null;
  const liveUrl = snapshot?.liveUrl ?? null;
  const actively = snapshot?.designerActivelyWorking === true;

  return (
    <header className="flex flex-col gap-3 rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate font-display text-sx-xl font-semibold text-[var(--text-primary)] sm:text-sx-2xl">
            {project.name}
          </h1>
          <SxBadge variant={badge.variant}>{badge.label}</SxBadge>
          {project.planName ? (
            <span className="rounded-full bg-[var(--surface-sunken)] px-3 py-1 font-mono text-sx-2xs text-[var(--text-secondary)]">
              {project.planName}
            </span>
          ) : null}
          {actively ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-bg)] px-3 py-1 font-mono text-sx-2xs text-[var(--color-success-fg)]">
              <span className="size-1.5 animate-pulse rounded-full bg-[var(--color-success-500)]" aria-hidden="true" />
              Sitropix is actively building
            </span>
          ) : null}
        </div>
        {project.description ? (
          <p className="mt-2 max-w-3xl text-sx-sm text-[var(--text-secondary)]">{project.description}</p>
        ) : null}
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-sx-2xs text-[var(--text-tertiary)]">
          <div>
            <dt className="inline">Designer:</dt>{" "}
            <dd className="inline text-[var(--text-secondary)]">{designerName ?? "Not yet assigned"}</dd>
          </div>
          {snapshot?.stagingUrl ? (
            <div>
              <dt className="inline">Staging:</dt>{" "}
              <dd className="inline">
                <a className="text-[var(--text-brand)] hover:underline" href={snapshot.stagingUrl} target="_blank" rel="noopener noreferrer">
                  {snapshot.stagingUrl.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {liveUrl ? (
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-[30px] items-center justify-center rounded-sx-md bg-[var(--color-brand-500)] px-3 font-ui text-sx-xs font-semibold text-white hover:bg-[var(--color-brand-600)]"
          >
            Open live site →
          </a>
        ) : null}
      </div>
    </header>
  );
}
