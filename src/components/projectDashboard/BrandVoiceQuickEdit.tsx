import { useEffect, useState } from "react";
import { SxButton } from "@/components/sx/Button";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";
import { patchProjectSettings } from "@/services/projectWorkflowApi";

export function BrandVoiceQuickEdit(props: {
  projectId: string;
  initialValue: string;
  onSaved?: (next: string) => void;
  /** When true, render as read-only (staff viewing a customer-owned project). */
  readOnly?: boolean;
}) {
  const { projectId, initialValue, onSaved, readOnly } = props;
  const toast = useSxToast();
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const dirty = !readOnly && value.trim() !== (initialValue ?? "").trim();

  // Resync when the initial value changes (parent refresh after save, or projectId switch).
  // Skip while busy so we don't clobber the user mid-edit.
  useEffect(() => {
    if (!busy) setValue(initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      await patchProjectSettings(projectId, { brandVoiceShort: value.trim() });
      toast.success("Brand voice saved.");
      onSaved?.(value.trim());
    } catch (e) {
      toast.error("Couldn't save brand voice.", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SxPanel
      title="Brand voice"
      action={
        <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
          {readOnly ? "customer-controlled" : `${value.length}/800`}
        </span>
      }
    >
      <div id="brand-voice" className="flex flex-col gap-3">
        {readOnly ? (
          value.trim().length === 0 ? (
            <p className="text-sx-sm italic text-[var(--text-tertiary)]">
              The customer hasn't filled in brand voice yet.
            </p>
          ) : (
            <blockquote className="border-l-2 border-[var(--color-brand-500)] bg-[var(--surface-sunken)] px-3 py-2 text-sx-sm whitespace-pre-wrap text-[var(--text-primary)]">
              {value}
            </blockquote>
          )
        ) : (
          <>
            <p className="text-sx-sm text-[var(--text-secondary)]">
              In a few sentences, tell us how your brand should sound — playful, formal, technical,
              warm. Your designer will reference this in every section.
            </p>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, 800))}
              rows={4}
              placeholder="We sound like a friendly local barista — warm, direct, occasional humor."
              className="w-full resize-none rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sx-sm text-[var(--text-primary)] focus:border-[var(--color-brand-500)] focus:outline-none"
            />
            <div className="flex items-center justify-end">
              <SxButton onClick={save} disabled={!dirty || busy} loading={busy}>
                Save brand voice
              </SxButton>
            </div>
          </>
        )}
      </div>
    </SxPanel>
  );
}
