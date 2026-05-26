import { useEffect, useState } from "react";
import { SxButton } from "@/components/sx/Button";
import { SxPanel } from "@/components/sx/Panel";
import { SxSelect } from "@/components/sx/Input";
import { useSxToast } from "@/components/sx/Toast";
import {
  patchProjectUrls,
  updateProjectWorkflow,
} from "@/services/projectWorkflowApi";
import type {
  ProjectWorkflowSnapshot,
  ProjectWorkflowStatus,
} from "@/types/projectWorkflow";

const STATUS_CHOICES: Array<{ value: ProjectWorkflowStatus; label: string }> = [
  { value: "awaiting_brief", label: "Awaiting brief (customer)" },
  { value: "awaiting_assets", label: "Awaiting assets (customer)" },
  { value: "ready_to_start", label: "Ready to start" },
  { value: "in_progress", label: "In progress (build)" },
  { value: "awaiting_customer_reply", label: "Waiting on customer reply" },
  { value: "in_review", label: "In review (design ready)" },
  { value: "revisions_requested", label: "Revisions requested" },
  { value: "approved", label: "Approved" },
  { value: "live", label: "Live" },
  { value: "on_hold", label: "On hold" },
];

export function DesignerControlsCard(props: {
  projectId: string;
  snapshot: ProjectWorkflowSnapshot;
  onChanged: (next: ProjectWorkflowSnapshot) => void;
}) {
  const { projectId, snapshot, onChanged } = props;
  const toast = useSxToast();
  const [status, setStatus] = useState<ProjectWorkflowStatus>(snapshot.workflowStatus);
  const [percent, setPercent] = useState<number>(snapshot.phaseProgressOverride ?? 0);
  const [staging, setStaging] = useState<string>(snapshot.stagingUrl ?? "");
  const [live, setLive] = useState<string>(snapshot.liveUrl ?? "");
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [savingUrls, setSavingUrls] = useState(false);

  // Resync local form state when the snapshot changes (after our own save, or a parent refresh).
  // Without this, the inputs keep stale values and the dirty check fires incorrectly, letting a
  // stale "Save" clobber a more recent change made elsewhere.
  useEffect(() => {
    if (!savingWorkflow) {
      setStatus(snapshot.workflowStatus);
      setPercent(snapshot.phaseProgressOverride ?? 0);
    }
    if (!savingUrls) {
      setStaging(snapshot.stagingUrl ?? "");
      setLive(snapshot.liveUrl ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    snapshot.workflowStatus,
    snapshot.phaseProgressOverride,
    snapshot.stagingUrl,
    snapshot.liveUrl,
  ]);

  const workflowDirty = status !== snapshot.workflowStatus || percent !== (snapshot.phaseProgressOverride ?? 0);
  const urlsDirty = staging !== (snapshot.stagingUrl ?? "") || live !== (snapshot.liveUrl ?? "");

  async function saveWorkflow() {
    if (!workflowDirty || savingWorkflow) return;
    setSavingWorkflow(true);
    try {
      const next = await updateProjectWorkflow(projectId, {
        ...(status !== snapshot.workflowStatus ? { workflowStatus: status } : {}),
        ...(percent !== (snapshot.phaseProgressOverride ?? 0) ? { phaseProgressPercent: percent } : {}),
      });
      onChanged(next);
      toast.success("Workflow updated.");
    } catch (e) {
      toast.error("Couldn't update workflow.", e instanceof Error ? e.message : undefined);
    } finally {
      setSavingWorkflow(false);
    }
  }

  async function saveUrls() {
    if (!urlsDirty || savingUrls) return;
    setSavingUrls(true);
    try {
      const next = await patchProjectUrls(projectId, {
        ...(staging !== (snapshot.stagingUrl ?? "") ? { stagingUrl: staging.trim() } : {}),
        ...(live !== (snapshot.liveUrl ?? "") ? { liveUrl: live.trim() } : {}),
      });
      onChanged(next);
      toast.success("URLs updated.");
    } catch (e) {
      toast.error("Couldn't update URLs.", e instanceof Error ? e.message : undefined);
    } finally {
      setSavingUrls(false);
    }
  }

  return (
    <SxPanel
      title="Designer controls"
      action={<span className="font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">staff only</span>}
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <div>
            <label className="block font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">
              Workflow status
            </label>
            <SxSelect
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectWorkflowStatus)}
              disabled={savingWorkflow}
            >
              {STATUS_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </SxSelect>
          </div>
          <div>
            <label className="block font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">
              Progress % override
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={percent}
              onChange={(e) => setPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              disabled={savingWorkflow}
              className="h-[38px] w-full rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-sx-sm text-[var(--text-primary)] focus:border-[var(--color-brand-500)] focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <SxButton onClick={saveWorkflow} disabled={!workflowDirty || savingWorkflow} loading={savingWorkflow}>
              Save workflow
            </SxButton>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div>
            <label className="block font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">
              Staging URL
            </label>
            <input
              type="url"
              value={staging}
              placeholder="https://staging.example.com"
              onChange={(e) => setStaging(e.target.value)}
              disabled={savingUrls}
              className="h-[38px] w-full rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-sx-sm text-[var(--text-primary)] focus:border-[var(--color-brand-500)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">
              Live URL
            </label>
            <input
              type="url"
              value={live}
              placeholder="https://customer-site.com"
              onChange={(e) => setLive(e.target.value)}
              disabled={savingUrls}
              className="h-[38px] w-full rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-sx-sm text-[var(--text-primary)] focus:border-[var(--color-brand-500)] focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <SxButton onClick={saveUrls} disabled={!urlsDirty || savingUrls} loading={savingUrls}>
              Save URLs
            </SxButton>
          </div>
        </div>

        <p className="font-mono text-sx-2xs text-[var(--text-tertiary)]">
          Tip: leaving a chat message with "Mark as waiting for customer reply" checked flips the status to <code>awaiting_customer_reply</code> automatically — you usually don't need to set it manually.
        </p>
      </div>
    </SxPanel>
  );
}
