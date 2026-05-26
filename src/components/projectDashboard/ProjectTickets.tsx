import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SxBadge } from "@/components/sx/Badge";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxPanel } from "@/components/sx/Panel";
import { getProjectTickets } from "@/services/projectWorkflowApi";
import type { ProjectTicketSummary } from "@/types/projectWorkflow";

function statusVariant(status: string): "success" | "warning" | "neutral" {
  if (status === "resolved" || status === "closed") return "success";
  if (status === "in_progress" || status === "hold") return "warning";
  return "neutral";
}

export function ProjectTickets(props: { projectId: string }) {
  const [rows, setRows] = useState<ProjectTicketSummary[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getProjectTickets(props.projectId)
      .then((r) => {
        if (!cancelled) setRows(r.items);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [props.projectId]);

  return (
    <SxPanel
      title="Tickets for this project"
      action={
        <Link
          to={`/support/new?projectId=${encodeURIComponent(props.projectId)}`}
          className="font-ui text-sx-xs font-semibold text-[var(--text-brand)] hover:underline"
        >
          + New ticket
        </Link>
      }
    >
      {rows === null ? (
        <p className="text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
      ) : rows.length === 0 ? (
        <SxEmptyState
          title="No tickets yet."
          description="Open a ticket when you want a specific edit, fix, or change."
        />
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {rows.map((t) => (
            <li key={t.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                to={`/support/tickets/${encodeURIComponent(t.id)}`}
                className="min-w-0 truncate font-ui text-sx-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-brand)]"
              >
                {t.subject}
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <SxBadge variant={statusVariant(t.status)}>{t.status}</SxBadge>
                <span className="font-mono text-sx-2xs text-[var(--text-tertiary)]">
                  {new Date(t.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SxPanel>
  );
}
