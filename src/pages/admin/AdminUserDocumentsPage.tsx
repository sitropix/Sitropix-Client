import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { isModuleForbiddenError } from "@/services/http";
import { adminDeleteClientDocument, adminUploadClientDocument, fetchAdminUserDocuments } from "@/services/subscriptionsApi";
import type { ClientDocumentRow } from "@/types/subscription";

export function AdminUserDocumentsPage() {
  const { userId } = useParams<{ userId: string }>();
  const location = useLocation();
  const emailHint = (location.state as { email?: string } | null)?.email;
  const [rows, setRows] = useState<ClientDocumentRow[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noModuleAccess, setNoModuleAccess] = useState(false);

  async function load() {
    if (!userId) return;
    setLoading(true);
    setNoModuleAccess(false);
    try {
      setRows(await fetchAdminUserDocuments(userId));
    } catch (err) {
      if (isModuleForbiddenError(err)) {
        setNoModuleAccess(true);
        return;
      }
      setNotice("Could not load documents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [userId]);

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Customer Documents" />;
  }

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!userId || !file) {
      setNotice("Choose a file to upload.");
      return;
    }
    setNotice(null);
    try {
      await adminUploadClientDocument(userId, file, title.trim() || file.name, category.trim() || "General");
      setTitle("");
      setFile(null);
      await load();
    } catch {
      setNotice("Upload failed.");
    }
  }

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: "Admin", to: "/admin" },
          { label: "Customers", to: "/admin/customers" },
          { label: "Documents" },
        ]}
      />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Client documents</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {emailHint ? <span className="text-white/90">{emailHint}</span> : <span className="font-mono text-xs">{userId}</span>}
          </p>
        </div>
        <Link
          to="/admin/customers"
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:border-brand-lime/35"
        >
          Back to customers
        </Link>
      </header>

      {notice && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{notice}</p>}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-sm font-semibold text-white">Upload</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onUpload}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="md:col-span-2 text-sm text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand-lime file:px-4 file:py-2 file:text-sm file:font-semibold file:text-canvas"
          />
          <button
            type="submit"
            className="rounded-full bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas transition hover:bg-brand-lime-dim md:col-span-2"
          >
            Upload for client
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-sm font-semibold text-white">Library</h2>
        {loading ? (
          <p className="mt-3 text-sm text-ink-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No files yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {rows.map((d) => (
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
                  onClick={() => void adminDeleteClientDocument(d.id).then(load)}
                  className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-100 transition hover:bg-rose-500/15"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
