import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxPanel } from "@/components/sx/Panel";
import { SxSelect } from "@/components/sx/Input";
import { useSxToast } from "@/components/sx/Toast";
import { useAuthz } from "@/context/AuthzContext";
import {
  assignProjectDesigner,
  getDesignerQueue,
  listAdminStaff,
} from "@/services/projectWorkflowApi";
import type {
  DesignerQueueRow,
  ProjectWorkflowStatus,
  StaffUserRef,
} from "@/types/projectWorkflow";

const STATUS_FILTERS: Array<{ value: ProjectWorkflowStatus | ""; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "awaiting_brief", label: "Awaiting brief" },
  { value: "awaiting_assets", label: "Awaiting assets" },
  { value: "ready_to_start", label: "Ready to start" },
  { value: "in_progress", label: "In progress" },
  { value: "awaiting_customer_reply", label: "Waiting on customer" },
  { value: "in_review", label: "In review" },
  { value: "revisions_requested", label: "Revisions requested" },
  { value: "approved", label: "Approved" },
  { value: "live", label: "Live" },
  { value: "on_hold", label: "On hold" },
];

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export function DesignerQueuePage() {
  const toast = useSxToast();
  const { isAdmin } = useAuthz();
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [status, setStatus] = useState<ProjectWorkflowStatus | "">("");
  const [rows, setRows] = useState<DesignerQueueRow[] | null>(null);
  const [staff, setStaff] = useState<StaffUserRef[]>([]);
  const [busyAssignId, setBusyAssignId] = useState<string | null>(null);

  async function refresh() {
    setRows(null);
    try {
      const out = await getDesignerQueue(scope, status);
      setRows(out.items);
    } catch (e) {
      setRows([]);
      toast.error("Couldn't load queue.", e instanceof Error ? e.message : undefined);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, status]);

  useEffect(() => {
    void listAdminStaff()
      .then((r) => setStaff(r.items))
      .catch(() => setStaff([]));
  }, []);

  const grouped = useMemo(() => {
    if (!rows) return new Map<string, DesignerQueueRow[]>();
    const m = new Map<string, DesignerQueueRow[]>();
    for (const r of rows) {
      const k = r.workflowLabel;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [rows]);

  async function reassign(projectId: string, designerUserId: string | null) {
    setBusyAssignId(projectId);
    try {
      await assignProjectDesigner(projectId, designerUserId);
      toast.success("Reassigned.");
      await refresh();
    } catch (e) {
      toast.error("Couldn't reassign.", e instanceof Error ? e.message : undefined);
    } finally {
      setBusyAssignId(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-sx-xl font-semibold text-[var(--text-primary)]">Designer queue</h1>
        <p className="text-sx-sm text-[var(--text-tertiary)]">
          Projects organized by status. Toggle "All projects" to see the whole team's pipeline.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
        <label className="flex items-center gap-2 text-sx-xs text-[var(--text-secondary)]">
          <input
            type="radio"
            name="scope"
            checked={scope === "mine"}
            onChange={() => setScope("mine")}
          />
          Mine
        </label>
        {isAdmin ? (
          <label className="flex items-center gap-2 text-sx-xs text-[var(--text-secondary)]">
            <input
              type="radio"
              name="scope"
              checked={scope === "all"}
              onChange={() => setScope("all")}
            />
            All projects
          </label>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-sx-2xs text-[var(--text-tertiary)]">Status</span>
          <SxSelect value={status} onChange={(e) => setStatus(e.target.value as ProjectWorkflowStatus | "")}>
            {STATUS_FILTERS.map((f) => (
              <option key={f.value || "all"} value={f.value}>
                {f.label}
              </option>
            ))}
          </SxSelect>
          <SxButton variant="secondary" size="sm" onClick={() => void refresh()}>
            Refresh
          </SxButton>
        </div>
      </div>

      {rows === null ? (
        <p className="text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
      ) : rows.length === 0 ? (
        <SxEmptyState
          title="Nothing in this queue."
          description={scope === "mine" ? "No projects are currently assigned to you." : "No projects match this filter."}
        />
      ) : (
        Array.from(grouped.entries()).map(([label, list]) => (
          <SxPanel key={label} title={`${label} · ${list.length}`}>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {list.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/admin/projects/${encodeURIComponent(r.id)}`}
                        className="truncate font-ui text-sx-sm font-semibold text-[var(--text-primary)] hover:text-[var(--text-brand)]"
                      >
                        {r.name}
                      </Link>
                      {r.unreadFromCustomer > 0 ? (
                        <SxBadge variant="warning">{r.unreadFromCustomer} unread</SxBadge>
                      ) : null}
                      {r.planName ? (
                        <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-sx-2xs text-[var(--text-secondary)]">
                          {r.planName}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 font-mono text-sx-2xs text-[var(--text-tertiary)]">
                      {r.ownerName ?? r.ownerEmail ?? "—"} · status changed {fmt(r.workflowChangedAt)} · customer last seen {fmt(r.lastCustomerActivityAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SxSelect
                      value={r.assignedDesigner?.id ?? ""}
                      onChange={(e) => void reassign(r.id, e.target.value || null)}
                      disabled={busyAssignId === r.id}
                    >
                      <option value="">— unassigned —</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                    </SxSelect>
                  </div>
                </li>
              ))}
            </ul>
          </SxPanel>
        ))
      )}
    </div>
  );
}
