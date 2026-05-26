import { useState } from "react";
import { SxButton } from "@/components/sx/Button";
import { useSxToast } from "@/components/sx/Toast";
import {
  issueProjectShareLink,
  revokeProjectShareLink,
} from "@/services/projectWorkflowApi";
import type { ProjectWorkflowSnapshot } from "@/types/projectWorkflow";

export function ShareLinkCard(props: {
  projectId: string;
  snapshot: ProjectWorkflowSnapshot;
  onChanged: () => void;
}) {
  const { projectId, snapshot, onChanged } = props;
  const toast = useSxToast();
  const [busy, setBusy] = useState(false);
  const [latestUrl, setLatestUrl] = useState<string | null>(null);

  async function issue(days: number | null) {
    if (busy) return;
    setBusy(true);
    try {
      const out = await issueProjectShareLink(projectId, days);
      setLatestUrl(out.url);
      onChanged();
      toast.success("Share link ready. Copy from below.");
    } catch (e) {
      toast.error("Couldn't create share link.", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (busy) return;
    setBusy(true);
    try {
      await revokeProjectShareLink(projectId);
      setLatestUrl(null);
      onChanged();
      toast.success("Share link revoked.");
    } catch (e) {
      toast.error("Couldn't revoke share link.", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
      <h3 className="font-display text-sx-sm font-semibold text-[var(--text-primary)]">Read-only share link</h3>
      <p className="mt-1 text-sx-xs text-[var(--text-tertiary)]">
        Show progress + URLs to anyone without giving them an account. Never reveals payments or chat.
      </p>
      {snapshot.shareLinkEnabled ? (
        <>
          {latestUrl ? (
            <div className="mt-3 flex items-center gap-2">
              <input
                readOnly
                value={latestUrl}
                onFocus={(e) => e.target.select()}
                className="min-w-0 flex-1 rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2 py-1 font-mono text-sx-2xs text-[var(--text-primary)]"
              />
              <SxButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(latestUrl).then(() => toast.success("Copied."));
                }}
              >
                Copy
              </SxButton>
            </div>
          ) : (
            <p className="mt-2 text-sx-xs text-[var(--text-secondary)]">
              Active. Regenerate to rotate the token, or revoke to disable.
            </p>
          )}
          {snapshot.shareLinkExpiresAt ? (
            <p className="mt-1 font-mono text-sx-2xs text-[var(--text-tertiary)]">
              Expires {new Date(snapshot.shareLinkExpiresAt).toLocaleDateString()}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <SxButton variant="secondary" size="sm" onClick={() => void issue(null)} disabled={busy}>
              Regenerate
            </SxButton>
            <SxButton variant="danger" size="sm" onClick={revoke} disabled={busy}>
              Revoke
            </SxButton>
          </div>
        </>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <SxButton size="sm" onClick={() => void issue(null)} disabled={busy} loading={busy}>
            Enable (no expiry)
          </SxButton>
          <SxButton variant="secondary" size="sm" onClick={() => void issue(30)} disabled={busy}>
            Enable for 30 days
          </SxButton>
        </div>
      )}
    </div>
  );
}
