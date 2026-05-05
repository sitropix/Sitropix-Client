import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  createProject,
  listProjectsByUser,
} from "@/services/projectsStore";
import { getProjectAssetReadinessForProjects } from "@/services/onboardingStore";

const STATUS_LABEL = {
  not_started: "Not started",
  on_hold: "On hold",
  active: "Active",
} as const;

const STATUS_PILL_CLASS = {
  active: "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-400/30",
  on_hold: "bg-amber-500/15 text-amber-600 ring-1 ring-amber-400/30",
  not_started: "bg-zinc-500/15 text-zinc-600 ring-1 ring-zinc-400/30",
} as const;

export function MyProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { portal } = useUser();
  const userId = user?.id ?? portal?.user?.id ?? "guest-user";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof listProjectsByUser>>>([]);
  const [readinessByProjectId, setReadinessByProjectId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void listProjectsByUser(userId)
      .then((rows) => {
        if (!cancelled) setProjects(rows);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    let cancelled = false;
    void getProjectAssetReadinessForProjects(projects)
      .then((value) => {
        if (!cancelled) setReadinessByProjectId(value);
      })
      .catch(() => {
        if (!cancelled) setReadinessByProjectId({});
      });
    return () => {
      cancelled = true;
    };
  }, [projects]);

  function forceRefresh() {
    void listProjectsByUser(userId, { force: true }).then(setProjects).catch(() => setProjects([]));
  }

  async function onCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const created = await createProject(userId, name, description);
    setName("");
    setDescription("");
    setSelectedProjectId(created.id);
    forceRefresh();
    navigate(`/projects/${created.id}`);
  }

  return (
    <div className="client-workspace-view space-y-5 text-zinc-900">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "My Projects" }]} />

      <header>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Projects</h1>
        <p className="mt-1 text-sm text-zinc-400">Manage multiple projects, their assets, and subscriptions independently.</p>
      </header>

      <section className="rounded-3xl border border-[#24292E] bg-[#15191C] p-5 shadow-glass sm:p-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Your Projects</h2>
            <p className="text-sm text-zinc-400">Manage your existing projects and their subscriptions.</p>
          </div>

          <form className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={onCreateProject}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="rounded-xl border border-[#2A3037] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary"
              className="rounded-xl border border-[#2A3037] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
            />
            <button
              type="submit"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-canvas transition hover:bg-zinc-200"
            >
              + New Project
            </button>
          </form>

          <div className="mt-4 space-y-3">
            {projects.length === 0 ? (
              <p className="rounded-2xl border border-[#2A3037] bg-[#1C2126] p-5 text-sm text-zinc-400">
                No projects yet. Create your first project to begin setup.
              </p>
            ) : (
              projects.map((project) => {
                const ready = readinessByProjectId[project.id] === true;
                return (
                  <article
                    key={project.id}
                    className={`rounded-2xl border p-4 transition ${
                      selectedProjectId === project.id
                        ? "border-zinc-500 bg-[#111418]"
                        : "border-[#2A3037] bg-[#101317] hover:border-zinc-500"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedProjectId(project.id)}
                        className="min-w-0 text-left"
                      >
                        <p className="truncate text-lg font-semibold text-white">{project.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                          <span>{project.planName ? `${project.planName} Plan` : "No valid plan"}</span>
                          <span aria-hidden>•</span>
                          <span>{project.invoices.length} invoices</span>
                        </div>
                      </button>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                          STATUS_PILL_CLASS[project.subscriptionStatus]
                        }`}
                      >
                        {STATUS_LABEL[project.subscriptionStatus]}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <Link
                        to={`/projects/${project.id}`}
                        className="rounded-lg border border-zinc-500 bg-[#2A3037] px-3 py-1.5 text-xs font-semibold text-white hover:border-zinc-300"
                      >
                        View Dashboard
                      </Link>
                      {project.subscriptionStatus === "active" ? null : (
                        <button
                          type="button"
                          onClick={() => navigate(`/projects/${project.id}/subscription`)}
                          disabled={!ready}
                          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-canvas transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {project.subscriptionStatus === "on_hold" ? "Renew Plan" : "Choose Plan"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
      </section>
    </div>
  );
}

