import { useState } from "react";
import { useSxToast } from "@/components/sx/Toast";
import { patchProjectSettings } from "@/services/projectWorkflowApi";
import type { ProjectWorkflowSnapshot } from "@/types/projectWorkflow";

function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-2">
      <span className="text-sx-sm text-[var(--text-secondary)]">{props.label}</span>
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.checked)}
        className="size-4 accent-[var(--color-brand-500)]"
      />
    </label>
  );
}

export function NotificationPrefsToggle(props: {
  projectId: string;
  snapshot: ProjectWorkflowSnapshot;
  onChanged: (next: ProjectWorkflowSnapshot) => void;
}) {
  const { projectId, snapshot, onChanged } = props;
  const toast = useSxToast();
  const [busy, setBusy] = useState(false);

  async function flip(field: "notifyOnDesignerReply" | "notifyOnPhaseChange", v: boolean) {
    setBusy(true);
    try {
      const next = await patchProjectSettings(projectId, { [field]: v });
      onChanged(next);
    } catch (e) {
      toast.error("Couldn't update preference.", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
      <h3 className="font-display text-sx-sm font-semibold text-[var(--text-primary)]">
        Notifications for this project
      </h3>
      <Toggle
        label="Email me when my designer replies"
        checked={snapshot.notifyOnDesignerReply}
        onChange={(v) => void flip("notifyOnDesignerReply", v)}
        disabled={busy}
      />
      <Toggle
        label="Email me when the phase changes"
        checked={snapshot.notifyOnPhaseChange}
        onChange={(v) => void flip("notifyOnPhaseChange", v)}
        disabled={busy}
      />
    </div>
  );
}
