import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { downloadClientDocumentFile, fetchMyDocuments } from "@/services/subscriptionsApi";
import type { ClientDocumentRow } from "@/types/subscription";

const EMBED_URL = import.meta.env.VITE_PROJECT_EMBED_URL as string | undefined;

type Tab = "project" | "documents";

export function WorkspacePage() {
  const [tab, setTab] = useState<Tab>("project");
  const [docs, setDocs] = useState<ClientDocumentRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    if (tab !== "documents") return;
    let cancelled = false;
    setLoadingDocs(true);
    void fetchMyDocuments()
      .then((rows) => {
        if (!cancelled) setDocs(rows);
      })
      .catch(() => {
        if (!cancelled) setDocs([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDocs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Workspace" }]} />
      <header>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Workspace</h1>
        <p className="mt-2 text-sm text-ink-muted">Project delivery view and documents shared by your team.</p>
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
          <p className="mt-1 text-sm text-ink-muted">Files uploaded by your account team appear here, grouped by category.</p>
          {loadingDocs ? (
            <p className="mt-4 text-sm text-ink-muted">Loading…</p>
          ) : docs.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No documents yet.</p>
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
