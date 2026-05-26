import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SxButton } from "@/components/sx/Button";
import { useSxToast } from "@/components/sx/Toast";
import {
  getAdminProjectBoard,
  getAdminProjectOverview,
  runWeeklyDigestNow,
} from "@/services/projectWorkflowApi";
import type {
  AdminProjectBoardBuckets,
  AdminProjectOverview,
  ProjectWorkflowStatus,
} from "@/types/projectWorkflow";

const COLUMN_ORDER: ProjectWorkflowStatus[] = [
  "awaiting_brief",
  "awaiting_assets",
  "ready_to_start",
  "in_progress",
  "awaiting_customer_reply",
  "in_review",
  "revisions_requested",
  "approved",
  "live",
  "on_hold",
];

export function AdminProjectBoardPage() {
  const toast = useSxToast();
  const [board, setBoard] = useState<AdminProjectBoardBuckets | null>(null);
  const [overview, setOverview] = useState<AdminProjectOverview | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);

  async function refresh() {
    try {
      const [b, o] = await Promise.all([getAdminProjectBoard(), getAdminProjectOverview()]);
      setBoard(b);
      setOverview(o);
    } catch (e) {
      toast.error("Couldn't load board.", e instanceof Error ? e.message : undefined);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function runDigest() {
    if (digestBusy) return;
    if (!window.confirm("Send the weekly digest email to every active customer with project activity?")) return;
    setDigestBusy(true);
    try {
      const out = await runWeeklyDigestNow();
      toast.success(`Digest run: ${out.sent} sent, ${out.skipped} skipped.`);
    } catch (e) {
      toast.error("Digest failed.", e instanceof Error ? e.message : undefined);
    } finally {
      setDigestBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-sx-xl font-semibold text-[var(--text-primary)]">Project board</h1>
          <p className="text-sx-sm text-[var(--text-tertiary)]">Cross-team view of every project, grouped by workflow phase.</p>
        </div>
        <div className="flex gap-2">
          <SxButton variant="secondary" size="sm" onClick={() => void refresh()}>
            Refresh
          </SxButton>
          <SxButton variant="cta" size="sm" onClick={runDigest} loading={digestBusy}>
            Send weekly digest now
          </SxButton>
        </div>
      </header>

      {overview ? (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total projects", value: overview.totals.totalProjects },
            { label: "Unassigned", value: overview.totals.awaitingAssignment, warn: overview.totals.awaitingAssignment > 0 },
            { label: "Waiting on customer", value: overview.totals.awaitingCustomer },
            { label: "In review", value: overview.totals.inReview },
            { label: "Live", value: overview.totals.live },
            { label: "On hold", value: overview.totals.onHold, warn: overview.totals.onHold > 0 },
          ].map((c) => (
            <div
              key={c.label}
              className={
                "rounded-sx-lg border p-3 " +
                (c.warn
                  ? "border-[var(--color-warning-500)]/40 bg-[var(--color-warning-bg)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-card)]")
              }
            >
              <p className="font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">{c.label}</p>
              <p className="mt-1 font-display text-sx-xl font-semibold text-[var(--text-primary)]">{c.value}</p>
            </div>
          ))}
        </section>
      ) : null}

      {overview && overview.stuckProjects.length > 0 ? (
        <section className="rounded-sx-lg border-2 border-[var(--color-warning-500)]/40 bg-[var(--color-warning-bg)] p-4">
          <h2 className="font-display text-sx-md font-semibold text-[var(--color-warning-fg)]">
            Stuck for &gt;7 days
          </h2>
          <ul className="mt-2 divide-y divide-[var(--color-warning-500)]/30">
            {overview.stuckProjects.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sx-sm text-[var(--color-warning-fg)]">
                <Link to={`/admin/projects/${encodeURIComponent(s.id)}`} className="truncate font-medium hover:underline">
                  {s.name}
                </Link>
                <span className="font-mono text-sx-2xs">
                  {s.workflowStatus.replace(/_/g, " ")} · {s.daysStuck}d · {s.designerName ?? "unassigned"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {board === null ? (
        <p className="text-sx-sm text-[var(--text-tertiary)]">Loading board…</p>
      ) : (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {COLUMN_ORDER.map((status) => {
            const items = board.buckets[status] ?? [];
            return (
              <div key={status} className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                <h3 className="mb-2 flex items-center justify-between font-display text-sx-sm font-semibold text-[var(--text-primary)]">
                  <span>{board.labels[status] ?? status}</span>
                  <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-sx-2xs text-[var(--text-secondary)]">
                    {items.length}
                  </span>
                </h3>
                {items.length === 0 ? (
                  <p className="text-sx-xs text-[var(--text-tertiary)]">—</p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((p) => (
                      <li key={p.id} className="rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-2">
                        <Link
                          to={`/admin/projects/${encodeURIComponent(p.id)}`}
                          className="block truncate font-ui text-sx-xs font-semibold text-[var(--text-primary)] hover:text-[var(--text-brand)]"
                        >
                          {p.name}
                        </Link>
                        <p className="mt-0.5 font-mono text-sx-2xs text-[var(--text-tertiary)]">
                          {p.ownerName ?? "—"} · {p.designerName ?? "unassigned"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
