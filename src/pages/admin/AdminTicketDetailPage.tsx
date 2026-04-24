import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchAdminTicketById, patchAdminTicketStatus, postAdminTicketReply } from "@/services/supportApi";
import type { SupportTicketDetail, TicketStatus } from "@/types/support";

type AdminDetail = SupportTicketDetail & { user: { id: string; name: string; email: string } };

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function AdminTicketDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<AdminDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [statusChoice, setStatusChoice] = useState<TicketStatus | "">("");
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!id) return;
    const d = await fetchAdminTicketById(id);
    setDetail(d);
    setStatusChoice(d.status);
  }

  useEffect(() => {
    if (id === undefined) return;
    const ticketId = id;
    let cancelled = false;
    async function run() {
      setLoading(true);
      setNotFound(false);
      try {
        const d = await fetchAdminTicketById(ticketId);
        if (!cancelled) {
          setDetail(d);
          setStatusChoice(d.status);
        }
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!id || !body.trim()) return;
    setError(null);
    setSending(true);
    try {
      const r = await postAdminTicketReply(id, body.trim());
      setBody("");
      await reload();
      if (r.status && detail) {
        setStatusChoice(r.status as TicketStatus);
      }
    } catch {
      setError("Could not send reply.");
    } finally {
      setSending(false);
    }
  }

  async function onStatusSave() {
    if (!id || !statusChoice || !detail || statusChoice === detail.status) return;
    setError(null);
    try {
      await patchAdminTicketStatus(id, statusChoice);
      await reload();
    } catch {
      setError("Could not update status.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
        <h1 className="text-xl font-semibold text-white">Ticket not found</h1>
        <Link to="/admin/tickets" className="mt-6 inline-block text-sm font-semibold text-brand-lime underline">
          Back to tickets
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: "Admin", to: "/admin" },
          { label: "Tickets", to: "/admin/tickets" },
          { label: `#${detail.id}` },
        ]}
      />
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-ink-subtle">#{detail.id}</span>
          <StatusBadge status={detail.status} />
        </div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">{detail.subject}</h1>
        <p className="text-sm text-ink-muted">
          Customer: <strong className="text-white/90">{detail.user.name}</strong> &lt;{detail.user.email}&gt;
        </p>
        <p className="text-xs text-ink-muted">
          Opened {formatWhen(detail.createdAt)} — last update {formatWhen(detail.updatedAt)}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="t-status" className="text-xs text-ink-subtle">
              Status
            </label>
            <select
              id="t-status"
              value={statusChoice}
              onChange={(e) => setStatusChoice(e.target.value as TicketStatus)}
              className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            >
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => void onStatusSave()}
            disabled={statusChoice === detail.status}
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-white transition enabled:hover:border-brand-lime/35 disabled:opacity-40"
          >
            Save status
          </button>
        </div>
      </header>

      <section className="space-y-4" aria-label="Thread">
        {detail.messages.map((m) => (
          <article
            key={m.id}
            className={`rounded-2xl border p-5 ${
              m.isStaff
                ? "border-brand-lime/20 bg-brand-lime/[0.04]"
                : "border-white/10 bg-white/[0.02]"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-white">
                {m.isStaff ? (m.author?.name ?? "Staff") : "Customer"}
              </p>
              <time className="text-xs text-ink-muted" dateTime={m.createdAt}>
                {formatWhen(m.createdAt)}
              </time>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink-muted">{m.body}</p>
          </article>
        ))}
      </section>

      <form onSubmit={onSend} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <label htmlFor="admin-reply" className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Staff reply
        </label>
        <textarea
          id="admin-reply"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-brand-lime/35"
          placeholder="Your response to the customer…"
        />
        {error && <p className="text-sm text-rose-200">{error}</p>}
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="inline-flex items-center justify-center rounded-full bg-brand-lime px-6 py-2.5 text-sm font-semibold text-canvas disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send and notify customer"}
        </button>
      </form>
    </div>
  );
}
