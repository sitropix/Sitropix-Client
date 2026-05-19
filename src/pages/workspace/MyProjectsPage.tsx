import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { portal } from "@/components/portal/portalStyles";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { useToast } from "@/components/Toast";
import { ProjectCreateForm } from "@/components/workspace/ProjectCreateForm";
import {
  hasValidProjectPlan,
  listProjectsByUser,
} from "@/services/projectsStore";
import { getProjectAssetReadinessForProjects } from "@/services/onboardingStore";
import {
  finalizeProjectCheckoutOnce,
  PROJECT_CHECKOUT_INTENT_KEY,
  type ProjectCheckoutIntent,
} from "@/services/projectCheckoutFinalize";
import { dispatchProjectsListInvalidate } from "@/services/projectsInvalidate";
import { ProjectSetupDialog } from "@/components/workspace/ProjectSetupDialog";

const STATUS_LABEL = {
  not_started: "Not started",
  on_hold: "On hold",
  active: "Active",
} as const;

const STATUS_PILL_CLASS = {
  active: "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-400/30",
  on_hold: "bg-amber-500/15 text-amber-800 ring-1 ring-amber-400/30",
  not_started: "bg-stone-3/30 text-on-surface-variant ring-1 ring-stone-3/50",
} as const;

export function MyProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { portal: portalUser, refresh: refreshUser } = useUser();
  const { showSuccess, showError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = user?.id ?? portalUser?.user?.id ?? null;
  const paymentSuccess = searchParams.get("payment_success");
  const isPaymentSuccess = paymentSuccess === "1";
  const paymentSource = searchParams.get("payment_source");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof listProjectsByUser>>>([]);
  const [readinessByProjectId, setReadinessByProjectId] = useState<Record<string, boolean>>({});
  const [setupDialogProject, setSetupDialogProject] = useState<
    Awaited<ReturnType<typeof listProjectsByUser>>[number] | null
  >(null);

  useEffect(() => {
    if (!userId) {
      setProjects([]);
      return;
    }
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
    if (!isPaymentSuccess && !selectedProjectId && projects[0]?.id) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, isPaymentSuccess]);

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

  const forceRefresh = useCallback(async () => {
    if (!userId) return [];
    try {
      const rows = await listProjectsByUser(userId, { force: true });
      setProjects(rows);
      return rows;
    } catch {
      setProjects([]);
      return [];
    }
  }, [userId]);

  useEffect(() => {
    if (!isPaymentSuccess) return;
    let cancelled = false;
    void (async () => {
      setSelectedProjectId(null);
      let subscriptionFinalizeOk = false;
      try {
        if (paymentSource === "subscription") {
          const raw = window.localStorage.getItem(PROJECT_CHECKOUT_INTENT_KEY);
          if (raw) {
            let intent: ProjectCheckoutIntent | null = null;
            try {
              intent = JSON.parse(raw) as ProjectCheckoutIntent;
            } catch {
              window.localStorage.removeItem(PROJECT_CHECKOUT_INTENT_KEY);
            }
            if (intent && Date.now() - intent.startedAt <= 2 * 60 * 60 * 1000) {
              try {
                await finalizeProjectCheckoutOnce(intent);
                subscriptionFinalizeOk = true;
              } catch (err) {
                if (!cancelled) {
                  showError(
                    err instanceof Error ? err.message : "Could not activate subscription after payment.",
                  );
                  navigate(`/projects/${encodeURIComponent(intent.projectId)}/subscription`, {
                    replace: true,
                  });
                }
                return;
              }
            }
          }
        }
        if (cancelled) return;
        await forceRefresh();
        dispatchProjectsListInvalidate();
        await refreshUser();
        if (!cancelled && (paymentSource === "addon" || subscriptionFinalizeOk)) {
          showSuccess("Payment completed successfully.");
        }
      } finally {
        if (!cancelled) setSearchParams({}, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isPaymentSuccess,
    paymentSource,
    refreshUser,
    showSuccess,
    showError,
    setSearchParams,
    forceRefresh,
    navigate,
  ]);

  return (
    <div className="client-workspace-view space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "My Projects" }]} />

      <header>
        <p className={portal.heroEyebrow}>Workspace</p>
        <h1 className={portal.pageTitle}>Projects</h1>
        <p className={portal.pageSubtitle}>
          Manage multiple projects, their assets, and subscriptions independently.
        </p>
      </header>

      <section className={`${portal.card} p-5 sm:p-6`}>
        <div>
          <h2 className="font-body text-body-lg font-semibold text-on-surface">Your Projects</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Manage your existing projects and their subscriptions.
          </p>
        </div>

        <div id="new-project" className="mt-4 scroll-mt-24">
          <ProjectCreateForm
            autoFocusName={typeof window !== "undefined" && window.location.hash === "#new-project"}
            onCreated={(created) => {
              setSelectedProjectId(created.id);
              void forceRefresh();
              navigate(`/projects/${created.id}`);
            }}
          />
        </div>

        <div className="mt-4 space-y-3">
          {projects.length === 0 ? (
            <p className="rounded-lg border ink-border-8 bg-surface-container-low p-5 font-body-sm text-body-sm text-on-surface-variant">
              No projects yet. Create your first project to begin setup.
            </p>
          ) : (
            projects.map((project) => {
              const ready = readinessByProjectId[project.id] === true;
              const selected = selectedProjectId === project.id;
              return (
                <article
                  key={project.id}
                  className={`rounded-lg border p-4 transition ${
                    selected
                      ? "ink-border-15 bg-surface-container ring-1 ring-accent-gold/25"
                      : "ink-border-8 bg-surface-container-lowest hover:ink-border-15"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedProjectId(project.id)}
                      className="min-w-0 text-left"
                    >
                      <p className="truncate font-body text-body-lg font-semibold text-on-surface">
                        {project.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 font-caption text-caption text-on-surface-variant">
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
                    {hasValidProjectPlan(project) ? (
                      <Link
                        to={`/projects/${project.id}`}
                        className={portal.btnSecondary + " !px-3 !py-1.5 !text-xs"}
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Dashboard
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={portal.btnSecondary + " !px-3 !py-1.5 !text-xs"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSetupDialogProject(project);
                        }}
                      >
                        View Dashboard
                      </button>
                    )}
                    {project.subscriptionStatus === "active" ? null : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${project.id}/subscription`);
                        }}
                        disabled={!ready}
                        className={portal.btnPrimary + " !px-3 !py-1.5 !text-xs disabled:opacity-40"}
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

      <ProjectSetupDialog
        project={setupDialogProject}
        open={setupDialogProject !== null}
        onClose={() => setSetupDialogProject(null)}
        onAssetsUpdated={async () => {
          const rows = await forceRefresh();
          try {
            const value = await getProjectAssetReadinessForProjects(rows);
            setReadinessByProjectId(value);
          } catch {
            setReadinessByProjectId({});
          }
          if (setupDialogProject) {
            const fresh = rows.find((p) => p.id === setupDialogProject.id);
            if (fresh) setSetupDialogProject(fresh);
          }
        }}
      />
    </div>
  );
}
