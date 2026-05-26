import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ProjectSetupDialog } from "@/components/workspace/ProjectSetupDialog";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { getProjectById, hasValidProjectPlan } from "@/services/projectsStore";
import { confirmAddonCheckoutSession } from "@/services/subscriptionsApi";
import { getProjectWorkflow } from "@/services/projectWorkflowApi";
import type { ProjectRecord } from "@/types/project";
import type { ProjectWorkflowSnapshot } from "@/types/projectWorkflow";
import { useSxToast } from "@/components/sx/Toast";
import { PendingCheckoutBanner } from "@/components/projectDashboard/PendingCheckoutBanner";
import { ProjectHeader } from "@/components/projectDashboard/ProjectHeader";
import { PhaseTracker } from "@/components/projectDashboard/PhaseTracker";
import { NextActionCard } from "@/components/projectDashboard/NextActionCard";
import { ProjectChat } from "@/components/projectDashboard/ProjectChat";
import { BrandVoiceQuickEdit } from "@/components/projectDashboard/BrandVoiceQuickEdit";
import { ApprovalCheckpointCard } from "@/components/projectDashboard/ApprovalCheckpointCard";
import { DesignerControlsCard } from "@/components/projectDashboard/DesignerControlsCard";
import { ProjectFilesCard } from "@/components/projectDashboard/ProjectFilesCard";
import { ProjectTickets } from "@/components/projectDashboard/ProjectTickets";
import { ProjectInvoices } from "@/components/projectDashboard/ProjectInvoices";
import { ProjectActivity } from "@/components/projectDashboard/ProjectActivity";
import { ProjectSidebar } from "@/components/projectDashboard/ProjectSidebar";

const STAFF_ROLES = new Set(["admin", "master_admin", "support"]);

export function ProjectDashboardPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { portal } = useUser();
  const toast = useSxToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [snapshot, setSnapshot] = useState<ProjectWorkflowSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupOverlayDismissed, setSetupOverlayDismissed] = useState(false);

  const userId = user?.id ?? portal?.user?.id ?? null;
  const role = user?.role ?? null;
  const viewerIsStaff = role ? STAFF_ROLES.has(role) : false;
  const viewerIsOwner = project ? project.ownerUserId === userId : false;

  async function refreshAll(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [proj, snap] = await Promise.all([
        getProjectById(projectId),
        getProjectWorkflow(projectId).catch(() => null),
      ]);
      setProject(proj);
      setSnapshot(snap);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
    setSetupOverlayDismissed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Stripe addon checkout return handler — preserve existing UX so addon flow continues to work.
  useEffect(() => {
    const funnel = searchParams.get("subscriptionFunnel");
    const sessionId = searchParams.get("session_id");
    const paramProjectId = searchParams.get("projectId");
    if (funnel !== "addon_checkout_return") return;
    if (!sessionId || !paramProjectId || paramProjectId !== projectId) return;
    void (async () => {
      try {
        await confirmAddonCheckoutSession(projectId, sessionId);
        navigate(
          { pathname: "/projects", search: "?payment_success=1&payment_source=addon" },
          { replace: true },
        );
      } catch (err) {
        toast.error("Couldn't confirm add-on purchase.", err instanceof Error ? err.message : undefined);
        setSearchParams({}, { replace: true });
      }
    })();
  }, [searchParams, projectId, navigate, setSearchParams, toast]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <p className="text-sx-sm text-[var(--text-tertiary)]">Loading project…</p>
      </div>
    );
  }

  if (!project) {
    // Staff land back on the queue; customers go to their projects list.
    return <Navigate to={viewerIsStaff ? "/admin/designer" : "/projects"} replace />;
  }

  // Owner-only when not staff. Staff can view any project.
  if (!viewerIsOwner && !viewerIsStaff) {
    return <Navigate to="/projects" replace />;
  }

  const showSetupOverlay = viewerIsOwner && !setupOverlayDismissed && !hasValidProjectPlan(project);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
      {viewerIsOwner ? <PendingCheckoutBanner project={project} snapshot={snapshot} /> : null}
      <ProjectHeader project={project} snapshot={snapshot} viewerIsStaff={viewerIsStaff} />
      {snapshot ? (
        <PhaseTracker status={snapshot.workflowStatus} progressPercent={snapshot.progressPercent} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="flex flex-col gap-4">
          {snapshot?.nextAction ? (
            <NextActionCard
              nextAction={snapshot.nextAction}
              viewerIsStaff={viewerIsStaff}
              staffUnreadCount={snapshot.staffUnreadCount ?? 0}
            />
          ) : null}

          {viewerIsStaff && snapshot ? (
            <DesignerControlsCard
              projectId={project.id}
              snapshot={snapshot}
              onChanged={(next) => setSnapshot(next)}
            />
          ) : null}

          <ProjectChat projectId={project.id} viewerIsStaff={viewerIsStaff} />

          {viewerIsOwner && snapshot ? (
            <ApprovalCheckpointCard
              projectId={project.id}
              snapshot={snapshot}
              onChanged={(next) => setSnapshot(next)}
            />
          ) : null}

          {snapshot ? (
            <BrandVoiceQuickEdit
              projectId={project.id}
              initialValue={snapshot.brandVoiceShort}
              onSaved={(next) => setSnapshot((s) => (s ? { ...s, brandVoiceShort: next } : s))}
              readOnly={!viewerIsOwner}
            />
          ) : null}

          <ProjectFilesCard projectId={project.id} />
          <ProjectTickets projectId={project.id} />
          <ProjectInvoices projectId={project.id} />
          <ProjectActivity projectId={project.id} />
        </div>

        <ProjectSidebar
          project={project}
          snapshot={snapshot}
          isOwner={viewerIsOwner}
          onSnapshotChanged={(next) => setSnapshot(next)}
          onShareLinkChanged={() => {
            void refreshAll(true);
          }}
        />
      </div>

      <ProjectSetupDialog
        project={project}
        open={showSetupOverlay && Boolean(project)}
        onClose={() => setSetupOverlayDismissed(true)}
      />
    </div>
  );
}
