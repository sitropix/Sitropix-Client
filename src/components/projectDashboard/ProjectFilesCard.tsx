import { useEffect, useRef, useState } from "react";
import { SxButton } from "@/components/sx/Button";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxPanel } from "@/components/sx/Panel";
import { SxSelect } from "@/components/sx/Input";
import { useSxToast } from "@/components/sx/Toast";
import {
  PROJECT_ASSET_TYPES,
} from "@/services/projectsStore";
import {
  deleteProjectAssetFile,
  downloadProjectAssetFromServer,
  fetchProjectAssets,
  uploadProjectAssetFile,
  type ProjectAssetUploadRow,
} from "@/services/subscriptionsApi";
import { formatFileSize } from "@/lib/formatFileSize";
import {
  DOCUMENT_MAX_BYTES,
  PROJECT_ASSET_MAX_PER_TYPE,
  documentMaxSizeLabelMb,
} from "@/lib/documentLimits";

function prettyType(t: string) {
  return t.replace(/_/g, " ");
}

export function ProjectFilesCard(props: { projectId: string }) {
  const { projectId } = props;
  const toast = useSxToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ProjectAssetUploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState(PROJECT_ASSET_TYPES[0]?.type ?? "requirements");
  const [file, setFile] = useState<File | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [busyDownloadId, setBusyDownloadId] = useState<string | null>(null);

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    try {
      const next = await fetchProjectAssets(projectId);
      setRows(next);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [projectId]);

  const countByType = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <SxPanel
      title="Project files"
      action={
        <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
          up to {PROJECT_ASSET_MAX_PER_TYPE} per type · {documentMaxSizeLabelMb()} each
        </span>
      }
    >
      <div id="project-files" className="flex flex-col gap-4">
        {loading ? (
          <p className="text-sx-sm text-[var(--text-tertiary)]">Loading files…</p>
        ) : rows.length === 0 ? (
          <SxEmptyState title="No files yet." description="Upload your logo, brand voice doc, and any requirements." />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)] rounded-sx-md border border-[var(--border-subtle)]">
            {rows.map((asset) => (
              <li key={`${asset.type}:${asset.id}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-ui text-sx-sm font-medium text-[var(--text-primary)]">{asset.fileName}</p>
                  <p className="mt-0.5 font-mono text-sx-2xs text-[var(--text-tertiary)]">
                    {formatFileSize(asset.sizeBytes)} · {prettyType(asset.type)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <SxButton
                    variant="secondary"
                    size="sm"
                    disabled={busy || busyDeleteId !== null || busyDownloadId === asset.id}
                    onClick={async () => {
                      setBusyDownloadId(asset.id);
                      try {
                        await downloadProjectAssetFromServer(projectId, asset.id);
                      } catch {
                        toast.error("Couldn't download.");
                      } finally {
                        setBusyDownloadId(null);
                      }
                    }}
                  >
                    {busyDownloadId === asset.id ? "Downloading…" : "Download"}
                  </SxButton>
                  <SxButton
                    variant="ghost"
                    size="sm"
                    className="!text-[var(--color-danger-fg)]"
                    disabled={busy || busyDeleteId !== null}
                    onClick={async () => {
                      setBusyDeleteId(asset.id);
                      try {
                        await deleteProjectAssetFile(projectId, asset.id);
                        await refresh(true);
                        toast.success("File removed.");
                      } catch (e) {
                        toast.error("Couldn't remove.", e instanceof Error ? e.message : undefined);
                      } finally {
                        setBusyDeleteId(null);
                      }
                    }}
                  >
                    Remove
                  </SxButton>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          className="grid gap-3 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-[200px_minmax(0,1fr)_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file || busy) return;
            if (file.size > DOCUMENT_MAX_BYTES) {
              toast.error(`File is too large (max ${documentMaxSizeLabelMb()}).`);
              return;
            }
            const atLimit = (countByType[type] ?? 0) >= PROJECT_ASSET_MAX_PER_TYPE;
            if (atLimit) {
              toast.error(`You already have ${PROJECT_ASSET_MAX_PER_TYPE} files in ${prettyType(type)}.`);
              return;
            }
            setBusy(true);
            try {
              await uploadProjectAssetFile(projectId, type, file);
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
              await refresh(true);
              toast.success("Uploaded.");
            } catch (e) {
              toast.error("Upload failed.", e instanceof Error ? e.message : undefined);
            } finally {
              setBusy(false);
            }
          }}
        >
          <SxSelect value={type} onChange={(e) => setType(e.target.value as typeof type)} disabled={busy}>
            {PROJECT_ASSET_TYPES.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label} ({countByType[t.type] ?? 0}/{PROJECT_ASSET_MAX_PER_TYPE})
              </option>
            ))}
          </SxSelect>
          <input
            ref={fileInputRef}
            type="file"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sx-sm text-[var(--text-primary)] file:mr-3 file:rounded-sx-sm file:border-0 file:bg-[var(--surface-sunken)] file:px-3 file:py-1 file:text-sx-xs file:font-semibold file:text-[var(--text-primary)]"
          />
          <SxButton type="submit" disabled={!file || busy} loading={busy}>
            Upload
          </SxButton>
        </form>
      </div>
    </SxPanel>
  );
}
