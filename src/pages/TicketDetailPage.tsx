import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchTicketById, postTicketReply } from "@/services/supportApi";
import type { SupportTicketDetail } from "@/types/support";

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function TicketDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === undefined) return;
    const ticketId = id;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const d = await fetchTicketById(ticketId);
        if (!cancelled) {
          setDetail(d);
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
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id || !body.trim()) return;
    setError(null);
    setSending(true);
    try {
      await postTicketReply(id, body.trim());
      setBody("");
      const d = await fetchTicketById(id);
      setDetail(d);
    } catch {
      setError("Could not send your message.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
        <h1 className="text-xl font-semibold text-white">Ticket not found</h1>
        <p className="mt-2 text-sm text-ink-muted">It may have been removed or the link is invalid.</p>
        <Link to="/requests" className="mt-6 inline-block text-sm font-semibold text-brand-lime underline">
          Back to my requests
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: "My requests", to: "/requests" },
          { label: `#${detail.id}` },
        ]}
      />
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-ink-subtle">#{detail.id}</span>
          <StatusBadge status={detail.status} />
          {detail.department && (
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-ink-muted">
              {detail.department}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{detail.subject}</h1>
        <p className="text-xs text-ink-muted">
          Opened {formatWhen(detail.createdAt)} — last update {formatWhen(detail.updatedAt)}
        </p>
      </header>

      <section className="space-y-4" aria-label="Conversation">
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
                {m.isStaff ? "Support" : m.author?.name ?? "You"}
              </p>
              <time className="text-xs text-ink-muted" dateTime={m.createdAt}>
                {formatWhen(m.createdAt)}
              </time>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink-muted">{m.body}</p>
          </article>
        ))}
      </section>

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <label htmlFor="reply" className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          Add a reply
        </label>
        <textarea
          id="reply"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-brand-lime/35 focus:ring-2 focus:ring-brand-lime/25"
          placeholder="More context, logs, or questions…"
        />
        {error && <p className="text-sm text-rose-200">{error}</p>}
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="inline-flex items-center justify-center rounded-full bg-brand-lime px-6 py-2.5 text-sm font-semibold text-canvas shadow-glow transition enabled:hover:scale-[1.02] enabled:hover:bg-brand-lime-dim disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send reply"}
        </button>
      </form>
    </div>
  );
}
