import { useState } from "react";
import { SxButton } from "@/components/sx/Button";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";
import { approveProject } from "@/services/projectWorkflowApi";
import type { ProjectWorkflowSnapshot } from "@/types/projectWorkflow";

export function ApprovalCheckpointCard(props: {
  projectId: string;
  snapshot: ProjectWorkflowSnapshot;
  onChanged: (next: ProjectWorkflowSnapshot) => void;
}) {
  const { projectId, snapshot, onChanged } = props;
  const toast = useSxToast();
  const [busyKind, setBusyKind] = useState<"design" | "launch" | null>(null);

  async function approve(kind: "design" | "launch") {
    if (busyKind) return;
    setBusyKind(kind);
    try {
      const next = await approveProject(projectId, kind);
      onChanged(next);
      toast.success(kind === "design" ? "Design approved." : "Launch approved.");
    } catch (e) {
      toast.error(
        `Couldn't approve ${kind}.`,
        e instanceof Error ? e.message : undefined,
      );
    } finally {
      setBusyKind(null);
    }
  }

  // Only show when there's a real action available.
  const showDesign = snapshot.workflowStatus === "in_review" && !snapshot.approvedDesignAt;
  const showLaunch =
    snapshot.approvedDesignAt && !snapshot.approvedLaunchAt && snapshot.workflowStatus !== "live";

  if (!showDesign && !showLaunch && !snapshot.approvedDesignAt && !snapshot.approvedLaunchAt) {
    return null;
  }

  return (
    <SxPanel title="Approvals">
      <div id="approval" className="flex flex-col gap-3">
        {snapshot.approvedDesignAt ? (
          <p className="text-sx-sm text-[var(--text-secondary)]">
            ✓ Design approved on {new Date(snapshot.approvedDesignAt).toLocaleDateString()}
          </p>
        ) : null}
        {snapshot.approvedLaunchAt ? (
          <p className="text-sx-sm text-[var(--text-secondary)]">
            ✓ Launch approved on {new Date(snapshot.approvedLaunchAt).toLocaleDateString()}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {showDesign ? (
            <SxButton
              variant="cta"
              onClick={() => void approve("design")}
              loading={busyKind === "design"}
              disabled={busyKind !== null}
            >
              Approve design
            </SxButton>
          ) : null}
          {showLaunch ? (
            <SxButton
              variant="cta"
              onClick={() => void approve("launch")}
              loading={busyKind === "launch"}
              disabled={busyKind !== null}
            >
              Approve launch
            </SxButton>
          ) : null}
        </div>
      </div>
    </SxPanel>
  );
}
