import { useEffect, useState } from "react";
import { fetchAdminUsers, fetchAdminUserProjects, createAdminUserProject } from "@/services/subscriptionsApi";
import type { AdminUserRow } from "@/types/subscription";
import type { ProjectRecord } from "@/types/project";

export function AdminProjectsPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projects, setProjects] = useState<ProjectRecord[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchAdminUsers();
        setUsers(data);
        if (data[0]?.id) setSelectedUserId(data[0].id);
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
        if (!cancelled) setProjects(rows);
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
    await createAdminUserProject(selectedUserId, { name, description });
    const rows = await fetchAdminUserProjects(selectedUserId);
    setProjects(rows);
    setName("");
    setDescription("");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-white">Customer Projects</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Create and manage projects for each customer independently.
        </p>
      </header>

      <section className="rounded-xl border border-[#24292E] bg-[#15191C] p-4">
        <form className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]" onSubmit={onCreate}>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="rounded border border-[#2b3137] bg-[#1C2126] px-3 py-2 text-sm text-white"
            disabled={loading}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="rounded border border-[#2b3137] bg-[#1C2126] px-3 py-2 text-sm text-white"
          />
          <button type="submit" className="rounded bg-brand-lime px-4 py-2 text-sm font-semibold text-canvas">
            Add project
          </button>
        </form>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Project description (optional)"
          className="mt-3 w-full rounded border border-[#2b3137] bg-[#1C2126] px-3 py-2 text-sm text-white"
        />
      </section>

      <section className="rounded-xl border border-[#24292E] bg-[#15191C] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-400">Projects</h2>
        {selectedUserId && projects.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">No projects for this customer yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {projects.map((p) => (
              <li key={p.id} className="rounded-lg border border-[#2b3137] bg-[#1C2126] px-3 py-2">
                <p className="text-sm font-semibold text-white">{p.name}</p>
                <p className="text-xs text-neutral-400">
                  Status: {p.subscriptionStatus} · Assets: {p.assets.length} · Plan: {p.planName ?? "none"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

