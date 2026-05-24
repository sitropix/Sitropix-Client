import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
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
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxPageHeader } from "@/components/sx/PageHeader";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";

type ProjectRow = Awaited<ReturnType<typeof listProjectsByUser>>[number];

function statusBadge(status: ProjectRow["subscriptionStatus"]) {
  if (status === "active") return <SxBadge variant="success">Active</SxBadge>;
  if (status === "on_hold") return <SxBadge variant="warning">On hold</SxBadge>;
  return <SxBadge variant="neutral">Not started</SxBadge>;
}

export function MyProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { portal: portalUser, refresh: refreshUser } = useUser();
  const toast = useSxToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = user?.id ?? portalUser?.user?.id ?? null;
  const paymentSuccess = searchParams.get("payment_success");
  const isPaymentSuccess = paymentSuccess === "1";
  const paymentSource = searchParams.get("payment_source");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [readinessByProjectId, setReadinessByProjectId] = useState<
    Record<string, boolean>
  >({});
  const [setupDialogProject, setSetupDialogProject] =
    useState<ProjectRow | null>(null);

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
    if (!userId) return [] as ProjectRow[];
    try {
      const rows = await listProjectsByUser(userId, { force: true });
      setProjects(rows);
      return rows;
    } catch {
      setProjects([]);
      return [] as ProjectRow[];
    }
  }, [userId]);

  useEffect(() => {
    if (!isPaymentSuccess) return;
    let cancelled = false;
    void (async () => {
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
                  toast.error(
                    "Couldn't activate subscription.",
                    err instanceof Error ? err.message : undefined,
                  );
                  navigate(
                    `/projects/${encodeURIComponent(intent.projectId)}/plan`,
                    { replace: true },
                  );
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
          toast.success("Payment complete.");
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
    toast,
    setSearchParams,
    forceRefresh,
    navigate,
  ]);

  return (
    <div data-sx-root className="flex flex-col gap-6">
      <SxPageHeader
        title="My projects"
        description="Each project has its own plan, assets, and ticket history."
      />

      <SxPanel
        title="Create a project"
        action={
          <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
            About 3 minutes
          </span>
        }
      >
        <ProjectCreateForm
          autoFocusName={
            typeof window !== "undefined" &&
            window.location.hash === "#new-project"
          }
          onCreated={(created) => {
            void forceRefresh();
            navigate(`/projects/${created.id}`);
          }}
        />
      </SxPanel>

      {projects.length === 0 ? (
        <SxEmptyState
          title="No projects yet."
          description="Create your first project above to get a site online — it takes about three minutes."
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Your projects">
          {projects.map((project) => {
            const ready = readinessByProjectId[project.id] === true;
            return (
              <li key={project.id}>
                <article className="flex flex-col gap-3 rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 transition-colors duration-[150ms] hover:border-[var(--border-strong)] sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/projects/${project.id}`}
                          className="truncate font-ui text-sx-md font-semibold text-[var(--text-primary)] hover:text-[var(--text-brand)]"
                        >
                          {project.name}
                        </Link>
                        {statusBadge(project.subscriptionStatus)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sx-xs text-[var(--text-tertiary)]">
                        <span>{project.planName ?? "No plan"}</span>
                        <span aria-hidden>·</span>
                        <span>
                          {project.invoices.length} invoice
                          {project.invoices.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
                      {hasValidProjectPlan(project) ? (
                        <Link to={`/projects/${project.id}`}>
                          <SxButton variant="secondary" size="sm">
                            Open dashboard
                          </SxButton>
                        </Link>
                      ) : (
                        <SxButton
                          variant="secondary"
                          size="sm"
                          onClick={() => setSetupDialogProject(project)}
                        >
                          Open dashboard
                        </SxButton>
                      )}
                      {project.subscriptionStatus === "active" ? null : (
                        <SxButton
                          variant="primary"
                          size="sm"
                          disabled={!ready}
                          onClick={() =>
                            navigate(`/projects/${project.id}/plan`)
                          }
                        >
                          {project.subscriptionStatus === "on_hold"
                            ? "Renew plan"
                            : "Choose plan"}
                        </SxButton>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

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
