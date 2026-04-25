import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { downloadClientDocumentFile, fetchMyDocuments } from "@/services/subscriptionsApi";
import type { ClientDocumentRow } from "@/types/subscription";

const EMBED_URL = import.meta.env.VITE_PROJECT_EMBED_URL as string | undefined;

type Tab = "project" | "documents";

export function WorkspacePage() {
  const [searchParams] = useSearchParams();
  const tabFromUrl: Tab = searchParams.get("tab") === "documents" ? "documents" : "project";
  const [tab, setTab] = useState<Tab>(tabFromUrl);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);
  const [docs, setDocs] = useState<ClientDocumentRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);

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
          setDocsError("Could not load documents. Try again.");
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
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Workspace" }]} />
      <header>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Workspace</h1>
        <p className="mt-2 text-sm text-ink-muted">Project delivery view and documents your admin has shared with you.</p>
      </header>

      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
        {(
          [
            ["project", "Project"],
            ["documents", "Documents"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${tab === id ? "bg-brand-lime text-canvas" : "text-ink-muted hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "project" && (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-glass">
          {EMBED_URL ? (
            <iframe title="Project tracker" src={EMBED_URL} className="h-[min(72vh,720px)] w-full border-0" />
          ) : (
            <div className="p-8">
              <EmptyState
                title="Embed not configured"
                description="Set VITE_PROJECT_EMBED_URL in your environment to load your delivery tool (Linear, Jira, Notion, or a custom URL) inside this frame."
              />
            </div>
          )}
        </section>
      )}

      {tab === "documents" && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-sm font-semibold text-white">Your documents</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Files uploaded by your account team for your user appear here, grouped by category.
          </p>
          {docsError ? (
            <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{docsError}</p>
          ) : null}
          {loadingDocs ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : docs.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No documents yet. When an admin uploads files for you, they will show here.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{d.title}</p>
                    <p className="text-xs text-ink-muted">
                      {d.category} · {d.fileName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void downloadClientDocumentFile(d.id)}
                    className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white transition hover:border-brand-lime/35"
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
