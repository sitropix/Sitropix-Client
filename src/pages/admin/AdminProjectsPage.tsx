import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxPanel } from "@/components/sx/Panel";
import { SxSelect } from "@/components/sx/Input";
import { useSxToast } from "@/components/sx/Toast";
import {
  createAdminUserProject,
  fetchAdminUserProjects,
  fetchAdminUsers,
} from "@/services/subscriptionsApi";
import {
  assignProjectDesigner,
  listAdminStaff,
} from "@/services/projectWorkflowApi";
import type { AdminUserRow } from "@/types/subscription";
import type { ProjectRecord } from "@/types/project";
import type { StaffUserRef } from "@/types/projectWorkflow";

function badge(status: ProjectRecord["subscriptionStatus"]) {
  if (status === "active") return <SxBadge variant="success">Active</SxBadge>;
  if (status === "on_hold") return <SxBadge variant="warning">On hold</SxBadge>;
  return <SxBadge variant="neutral">Not started</SxBadge>;
}

interface AdminProjectRow extends ProjectRecord {
  workflowStatus?: string;
  workflowLabel?: string;
  assignedDesignerId?: string | null;
  assignedDesignerName?: string | null;
}

export function AdminProjectsPage() {
  const toast = useSxToast();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [projects, setProjects] = useState<AdminProjectRow[]>([]);
  const [staff, setStaff] = useState<StaffUserRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busyAssignId, setBusyAssignId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [u, s] = await Promise.all([fetchAdminUsers(), listAdminStaff()]);
        setUsers(u);
        setStaff(s.items);
        if (u[0]?.id) setSelectedUserId(u[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    void fetchAdminUserProjects(selectedUserId)
      .then((rows) => {
        if (!cancelled) setProjects(rows as AdminProjectRow[]);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || !name.trim()) return;
    try {
      await createAdminUserProject(selectedUserId, { name, description });
      const rows = await fetchAdminUserProjects(selectedUserId);
      setProjects(rows as AdminProjectRow[]);
      setName("");
      setDescription("");
      toast.success("Project created.");
    } catch (e) {
      toast.error("Couldn't create.", e instanceof Error ? e.message : undefined);
    }
  }

  async function reassign(projectId: string, designerUserId: string | null) {
    setBusyAssignId(projectId);
    try {
      await assignProjectDesigner(projectId, designerUserId);
      const rows = await fetchAdminUserProjects(selectedUserId);
      setProjects(rows as AdminProjectRow[]);
      toast.success("Designer updated.");
    } catch (e) {
      toast.error("Couldn't update.", e instanceof Error ? e.message : undefined);
    } finally {
      setBusyAssignId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-sx-xl font-semibold text-[var(--text-primary)]">Customer projects</h1>
        <p className="text-sx-sm text-[var(--text-tertiary)]">
          Browse each customer's projects, create new ones, and assign a designer.
        </p>
      </header>

      <SxPanel title="Add project for customer">
        <form className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)_auto]" onSubmit={onCreate}>
          <SxSelect
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={loading}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </SxSelect>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sx-sm text-[var(--text-primary)]"
          />
          <SxButton type="submit" disabled={!name.trim() || !selectedUserId}>
            Add project
          </SxButton>
        </form>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="mt-3 w-full rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sx-sm text-[var(--text-primary)]"
        />
      </SxPanel>

      <SxPanel title="Projects for selected customer">
        {!selectedUserId ? (
          <p className="text-sx-sm text-[var(--text-tertiary)]">Pick a customer above.</p>
        ) : projects.length === 0 ? (
          <SxEmptyState title="No projects." description="This customer has not created any projects yet." />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {projects.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/projects/${encodeURIComponent(p.id)}`}
                      className="truncate font-ui text-sx-sm font-semibold text-[var(--text-primary)] hover:text-[var(--text-brand)]"
                    >
                      {p.name}
                    </Link>
                    {badge(p.subscriptionStatus)}
                    {p.workflowLabel ? (
                      <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-sx-2xs text-[var(--text-secondary)]">
                        {p.workflowLabel}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 font-mono text-sx-2xs text-[var(--text-tertiary)]">
                    Plan {p.planName ?? "none"} · {p.assets.length} files · {p.invoices.length} invoices
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <SxSelect
                    value={p.assignedDesignerId ?? ""}
                    onChange={(e) => void reassign(p.id, e.target.value || null)}
                    disabled={busyAssignId === p.id}
                  >
                    <option value="">— unassigned —</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </SxSelect>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SxPanel>
    </div>
  );
}
