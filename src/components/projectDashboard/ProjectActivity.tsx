import { useEffect, useState } from "react";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxPanel } from "@/components/sx/Panel";
import { getProjectActivity } from "@/services/projectWorkflowApi";
import type { ProjectActivityEvent } from "@/types/projectWorkflow";

const ACTION_LABEL: Record<string, string> = {
  "project.workflow_changed": "Project status changed",
  "project.chat_message_sent": "Chat message sent",
  "project.designer_assigned": "Designer assigned",
  "project.approved_design": "Design approved",
  "project.approved_launch": "Launch approved",
  "project.urls_updated": "Project URLs updated",
  "project.settings_updated": "Project settings updated",
  "project.share_link_issued": "Share link enabled",
  "project.share_link_revoked": "Share link revoked",
};

function actionLabel(action: string, metadata: Record<string, unknown>): string {
  if (action === "project.workflow_changed" && metadata?.toStatus) {
    return `Status → ${String(metadata.toStatus).replace(/_/g, " ")}`;
  }
  return ACTION_LABEL[action] ?? action;
}

export function ProjectActivity(props: { projectId: string }) {
  const [rows, setRows] = useState<ProjectActivityEvent[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getProjectActivity(props.projectId)
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
    <SxPanel title="Recent activity">
      {rows === null ? (
        <p className="text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
      ) : rows.length === 0 ? (
        <SxEmptyState
          title="No activity yet."
          description="Things you and your designer do on this project show up here."
        />
      ) : (
        <ol className="relative ml-2 border-l border-[var(--border-subtle)] pl-4">
          {rows.map((a) => (
            <li key={a.id} className="relative py-2">
              <span
                className="absolute -left-[19px] top-3 size-2.5 rounded-full bg-[var(--color-brand-500)]"
                aria-hidden="true"
              />
              <p className="text-sx-sm text-[var(--text-primary)]">{actionLabel(a.action, a.metadata as Record<string, unknown>)}</p>
              <p className="font-mono text-sx-2xs text-[var(--text-tertiary)]">
                {new Date(a.createdAt).toLocaleString()} · {a.actorRole ?? "system"}
              </p>
            </li>
          ))}
        </ol>
      )}
    </SxPanel>
  );
}
