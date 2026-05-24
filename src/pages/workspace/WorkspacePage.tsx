import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/Skeleton";
import {
  downloadClientDocumentFile,
  fetchMyDocuments,
} from "@/services/subscriptionsApi";
import type { ClientDocumentRow } from "@/types/subscription";
import { SxButton } from "@/components/sx/Button";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxPageHeader } from "@/components/sx/PageHeader";
import { SxPanel } from "@/components/sx/Panel";
import { SxSegmentedControl } from "@/components/sx/SegmentedControl";

const EMBED_URL = import.meta.env.VITE_PROJECT_EMBED_URL as string | undefined;

type Tab = "project" | "documents";

export function WorkspacePage() {
  const [searchParams] = useSearchParams();
  const tabFromUrl: Tab =
    searchParams.get("tab") === "documents" ? "documents" : "project";
  const [tab, setTab] = useState<Tab>(tabFromUrl);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  const [docs, setDocs] = useState<ClientDocumentRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingDocs(true);
    setDocsError(null);
    void fetchMyDocuments()
      .then((rows) => {
        if (!cancelled) setDocs(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setDocs([]);
          setDocsError("Couldn't load documents. Try again in a moment.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDocs(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div data-sx-root className="flex flex-col gap-6">
      <SxPageHeader
        title="Files"
        description="Project delivery view, plus documents your account team has shared with you."
      />

      <SxSegmentedControl<Tab>
        ariaLabel="Switch view"
        options={[
          { value: "project", label: "Project" },
          { value: "documents", label: "Documents" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "project" && (
        <SxPanel padded={false}>
          {EMBED_URL ? (
            <iframe
              title="Project tracker"
              src={EMBED_URL}
              className="block h-[min(72vh,720px)] w-full border-0"
            />
          ) : (
            <div className="p-6">
              <SxEmptyState
                title="Project view not configured."
                description="Set VITE_PROJECT_EMBED_URL in your environment to embed your delivery tool here."
              />
            </div>
          )}
        </SxPanel>
      )}

      {tab === "documents" && (
        <SxPanel
          title="Your documents"
          action={
            docs.length > 0 ? (
              <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
                {docs.length} file{docs.length === 1 ? "" : "s"}
              </span>
            ) : null
          }
        >
          {docsError ? (
            <div
              role="alert"
              className="mb-4 rounded-sx-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-sx-sm text-[var(--color-danger-fg)]"
            >
              {docsError}
            </div>
          ) : null}

          {loadingDocs ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full rounded-sx-md" />
              <Skeleton className="h-14 w-full rounded-sx-md" />
            </div>
          ) : docs.length === 0 ? (
            <SxEmptyState
              title="No files yet."
              description="Your account manager will upload brand assets and content drops here when work begins."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--border-subtle)] rounded-sx-md border border-[var(--border-subtle)]">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-col items-start justify-between gap-2 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-ui text-sx-sm font-medium text-[var(--text-primary)]">
                      {d.title}
                    </p>
                    <p className="mt-0.5 font-mono text-sx-2xs text-[var(--text-tertiary)]">
                      {d.category} · {d.fileName}
                    </p>
                  </div>
                  <SxButton
                    variant="secondary"
                    size="sm"
                    disabled={downloadingDocId !== null}
                    loading={downloadingDocId === d.id}
                    onClick={() => {
                      if (downloadingDocId) return;
                      setDownloadingDocId(d.id);
                      void downloadClientDocumentFile(d.id).finally(() => {
                        setDownloadingDocId(null);
                      });
                    }}
                  >
                    {downloadingDocId === d.id ? "Downloading…" : "Download"}
                  </SxButton>
                </li>
              ))}
            </ul>
          )}
        </SxPanel>
      )}
    </div>
  );
}
