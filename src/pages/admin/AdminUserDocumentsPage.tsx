import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  adminDeleteClientDocument,
  adminUploadClientDocument,
  downloadClientDocumentFile,
  fetchAdminUserDocuments,
} from "@/services/subscriptionsApi";
import type { ClientDocumentRow } from "@/types/subscription";
import { SxButton } from "@/components/sx/Button";
import { SxConfirmDialog } from "@/components/sx/ConfirmDialog";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxInput } from "@/components/sx/Input";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";

function bytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function AdminUserDocumentsPage() {
  const { userId = "" } = useParams();
  const toast = useSxToast();
  const [docs, setDocs] = useState<ClientDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const rows = await fetchAdminUserDocuments(userId);
      setDocs(rows);
    } catch {
      toast.error("Couldn't load documents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    void reload();
  }, [userId]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.warning("Pick a file first.");
      return;
    }
    if (!title.trim()) {
      toast.warning("Add a title.");
      return;
    }
    setUploading(true);
    try {
      await adminUploadClientDocument(
        userId,
        file,
        title.trim(),
        category.trim() || "General",
      );
      toast.success("Document uploaded.");
      setFile(null);
      setTitle("");
      await reload();
    } catch (err) {
      toast.error(
        "Upload failed.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await adminDeleteClientDocument(deleteId);
      toast.success("Document removed.");
      setDeleteId(null);
      await reload();
    } catch (err) {
      toast.error(
        "Delete failed.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-[var(--border-subtle)] pb-4">
        <Link
          to="/admin/customers"
          className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] hover:text-[var(--text-brand)]"
        >
          ← Customers
        </Link>
        <h1 className="mt-2 font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          Customer documents
        </h1>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">
          Files shared with this customer. They see them under Files in their portal.
        </p>
      </header>

      <SxPanel title="Upload a document">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"
          onSubmit={(e) => void onUpload(e)}
        >
          <SxInput
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brand guidelines v2"
          />
          <SxInput
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="General"
          />
          <div className="flex flex-col gap-2">
            <label className="text-sx-xs font-semibold text-[var(--text-primary)]">
              File
            </label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="h-[38px] text-sx-xs text-[var(--text-secondary)] file:mr-2 file:rounded-sx-sm file:border-0 file:bg-[var(--color-brand-500)] file:px-3 file:py-1.5 file:text-sx-xs file:font-semibold file:text-white"
            />
          </div>
          <div className="sm:col-span-3">
            <SxButton type="submit" loading={uploading} disabled={!file}>
              Upload
            </SxButton>
          </div>
        </form>
      </SxPanel>

      <SxPanel title={`Documents (${docs.length})`} padded={false}>
        {loading ? (
          <p className="p-5 text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
        ) : docs.length === 0 ? (
          <div className="p-5">
            <SxEmptyState
              title="No documents yet."
              description="Upload a file above to share it with this customer."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-ui text-sx-sm font-medium text-[var(--text-primary)]">
                    {d.title}
                  </p>
                  <p className="mt-0.5 font-mono text-sx-2xs text-[var(--text-tertiary)]">
                    {d.category} · {d.fileName} · {bytesLabel(d.sizeBytes)} ·{" "}
                    {formatDate(d.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <SxButton
                    variant="secondary"
                    size="sm"
                    loading={downloadingId === d.id}
                    onClick={() => {
                      setDownloadingId(d.id);
                      void downloadClientDocumentFile(d.id).finally(() =>
                        setDownloadingId(null),
                      );
                    }}
                  >
                    Download
                  </SxButton>
                  <SxButton
                    variant="ghost"
                    size="sm"
                    className="!text-[var(--color-danger-fg)]"
                    onClick={() => setDeleteId(d.id)}
                  >
                    Remove
                  </SxButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SxPanel>

      <SxConfirmDialog
        open={deleteId !== null}
        title="Remove this document?"
        body="The customer will no longer see this file in their portal. This can't be undone."
        confirmLabel="Remove"
        destructive
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => !deleting && setDeleteId(null)}
      />
    </div>
  );
}
