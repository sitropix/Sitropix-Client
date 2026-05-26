import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SxLogo } from "@/components/sx/Logo";
import { getPublicProjectShareView } from "@/services/projectWorkflowApi";
import type { ProjectPublicShareView } from "@/types/projectWorkflow";

const PHASE_LABEL: Record<string, string> = {
  awaiting_brief: "Awaiting brief",
  awaiting_assets: "Awaiting assets",
  ready_to_start: "Ready to start",
  in_progress: "Build in progress",
  awaiting_customer_reply: "Waiting on customer",
  in_review: "In review",
  revisions_requested: "Revisions in flight",
  approved: "Approved",
  live: "Live",
  on_hold: "On hold",
};

const ACTION_LABEL: Record<string, string> = {
  "project.workflow_changed": "Status changed",
  "project.chat_message_sent": "Message exchanged",
  "project.designer_assigned": "Designer assigned",
  "project.approved_design": "Design approved",
  "project.approved_launch": "Launch approved",
  "project.urls_updated": "URLs updated",
};

export function ProjectSharePage() {
  const { token = "" } = useParams();
  const [view, setView] = useState<ProjectPublicShareView | "loading" | "error" | "expired">("loading");

  useEffect(() => {
    let cancelled = false;
    void getPublicProjectShareView(token)
      .then((v) => {
        if (!cancelled) setView(v);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("expired")) setView("expired");
        else setView("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (view === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
      </div>
    );
  }
  if (view === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="font-display text-sx-xl font-semibold text-[var(--text-primary)]">Share link not found</h1>
          <p className="mt-2 text-sx-sm text-[var(--text-tertiary)]">
            This link has been revoked or never existed.
          </p>
        </div>
      </div>
    );
  }
  if (view === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="font-display text-sx-xl font-semibold text-[var(--text-primary)]">Share link expired</h1>
          <p className="mt-2 text-sx-sm text-[var(--text-tertiary)]">
            Ask the project owner for a fresh link.
          </p>
        </div>
      </div>
    );
  }

  const v = view;
  const progress = v.progressPercent ?? null;

  return (
    <div className="min-h-screen bg-[var(--surface-app)]">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-card)] px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <SxLogo />
          <span className="font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">Read-only share</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <section className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
          <p className="font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">Project</p>
          <h1 className="mt-1 font-display text-sx-2xl font-semibold text-[var(--text-primary)]">{v.name}</h1>
          {v.description ? <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">{v.description}</p> : null}
          {v.customerName ? (
            <p className="mt-2 font-mono text-sx-xs text-[var(--text-tertiary)]">Owner: {v.customerName}</p>
          ) : null}
          {v.assignedDesignerName ? (
            <p className="mt-1 font-mono text-sx-xs text-[var(--text-tertiary)]">
              Designer: {v.assignedDesignerName}
            </p>
          ) : null}

          <div className="mt-5 rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">Phase</span>
              <span className="font-ui text-sx-sm font-semibold text-[var(--text-primary)]">
                {PHASE_LABEL[v.workflowStatus] ?? v.workflowStatus}
              </span>
            </div>
            {progress !== null ? (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[var(--color-brand-500)]"
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                  aria-hidden="true"
                />
              </div>
            ) : null}
          </div>

          {v.stagingUrl || v.liveUrl ? (
            <div className="mt-5 flex flex-wrap gap-3">
              {v.stagingUrl ? (
                <a
                  href={v.stagingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-[38px] items-center justify-center rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] px-4 font-ui text-sx-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
                >
                  View staging →
                </a>
              ) : null}
              {v.liveUrl ? (
                <a
                  href={v.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-[38px] items-center justify-center rounded-sx-md bg-[var(--color-brand-500)] px-4 font-ui text-sx-sm font-semibold text-white hover:bg-[var(--color-brand-600)]"
                >
                  Open live site →
                </a>
              ) : null}
            </div>
          ) : null}
        </section>

        {v.recentActivity.length > 0 ? (
          <section className="mt-6 rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
            <h2 className="font-display text-sx-md font-semibold text-[var(--text-primary)]">Recent activity</h2>
            <ol className="mt-3 relative ml-2 border-l border-[var(--border-subtle)] pl-4">
              {v.recentActivity.map((a, i) => (
                <li key={i} className="relative py-2">
                  <span
                    className="absolute -left-[19px] top-3 size-2.5 rounded-full bg-[var(--color-brand-500)]"
                    aria-hidden="true"
                  />
                  <p className="text-sx-sm text-[var(--text-primary)]">{ACTION_LABEL[a.action] ?? a.action}</p>
                  <p className="font-mono text-sx-2xs text-[var(--text-tertiary)]">
                    {a.at ? new Date(a.at).toLocaleString() : ""}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <p className="mt-8 text-center font-mono text-sx-2xs text-[var(--text-tertiary)]">{v.poweredBy}</p>
      </main>
    </div>
  );
}
