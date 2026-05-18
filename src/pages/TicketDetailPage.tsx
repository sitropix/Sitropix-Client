import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ButtonLoader } from "@/components/ButtonLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RichTextContent } from "@/components/RichTextContent";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ApiRequestError } from "@/services/http";
import { useTickets } from "@/hooks/useTickets";
import {
  canUserCloseTicket,
  canUserDeleteTicket,
  canUserReopenTicket,
  isTicketReplyable,
} from "@/lib/supportTicketLifecycle";
import {
  closeSupportTicket,
  deleteSupportTicket,
  downloadTicketAttachment,
  fetchTicketById,
  postTicketReply,
  reopenSupportTicket,
} from "@/services/supportApi";
import type { SupportTicketDetail } from "@/types/support";

type PendingAction = "close" | "delete" | "reopen" | null;

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { reload: reloadTickets } = useTickets();
  const { showSuccess, showError } = useToast();
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (id === undefined) return;
    const ticketId = id;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setNotFound(false);
      setLoadError(null);
      try {
        const d = await fetchTicketById(ticketId);
        if (!cancelled) {
          setDetail(d);
        }
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          if (e instanceof ApiRequestError && e.status === 404) setNotFound(true);
          else setLoadError("Unable to load this ticket.");
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

  async function refreshTicketAndList() {
    if (!id) return;
    const [d] = await Promise.all([fetchTicketById(id), reloadTickets()]);
    setDetail(d);
  }

  async function confirmCloseTicket() {
    if (!id || !detail || !canUserCloseTicket(detail)) return;
    setActionBusy(true);
    try {
      const result = await closeSupportTicket(id);
      await refreshTicketAndList();
      if (result.creditsRefunded) {
        showSuccess("Request closed. Reserved edit credits were returned to your project.");
      } else {
        showSuccess("Request closed.");
      }
      setPendingAction(null);
    } catch {
      showError("Could not close this request. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmDeleteTicket() {
    if (!id || !detail || !canUserDeleteTicket(detail)) return;
    setActionBusy(true);
    try {
      await deleteSupportTicket(id);
      await reloadTickets();
      showSuccess("Request deleted.");
      setPendingAction(null);
      navigate("/requests", { replace: true });
    } catch {
      showError("Could not delete this request. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmReopenTicket() {
    if (!id || !detail || !canUserReopenTicket(detail)) return;
    setActionBusy(true);
    try {
      await reopenSupportTicket(id);
      await refreshTicketAndList();
      showSuccess("Request reopened. You can add replies again.");
      setPendingAction(null);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "insufficient_credits") {
        showError(
          "Not enough website edit credits on this project to reopen this edit request. Buy more credits from your project dashboard.",
        );
      } else {
        showError("Could not reopen this request. Please try again.");
      }
    } finally {
      setActionBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id || !body.trim()) return;
    setSending(true);
    try {
      await postTicketReply(id, body.trim());
      setBody("");
      await refreshTicketAndList();
      showSuccess("Reply sent successfully.");
    } catch {
      showError("Could not send your message. Please try again.");
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

  if (loadError && !detail) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
        <h1 className="text-xl font-semibold text-white">{loadError}</h1>
        <p className="mt-2 text-sm text-ink-muted">Check your connection and try again.</p>
        <button
          type="button"
          disabled={retryBusy}
          aria-busy={retryBusy}
          onClick={() => {
            if (retryBusy || !id) return;
            setRetryBusy(true);
            setLoadError(null);
            setLoading(true);
            void (async () => {
              try {
                const d = await fetchTicketById(id);
                setLoadError(null);
                setNotFound(false);
                setDetail(d);
              } catch (e) {
                if (e instanceof ApiRequestError && e.status === 404) setNotFound(true);
                else setLoadError("Unable to load this ticket.");
              } finally {
                setLoading(false);
                setRetryBusy(false);
              }
            })();
          }}
          className="mt-6 inline-block rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-brand-lime/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {retryBusy ? "Retrying…" : "Retry"}
        </button>
        <div className="mt-4">
          <Link to="/requests" className="text-sm font-semibold text-brand-lime underline">
            Back to my requests
          </Link>
        </div>
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
          { label: "Home", to: "/dashboard" },
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
        {detail.projectName && detail.projectId ? (
          <p className="text-sm text-ink-muted">
            Linked project:{" "}
            <Link
              to={`/projects/${detail.projectId}`}
              className="font-medium text-brand-lime underline-offset-2 hover:underline"
            >
              {detail.projectName}
            </Link>
          </p>
        ) : null}
        <p className="text-xs text-ink-muted">
          Opened {formatWhen(detail.createdAt)} — last update {formatWhen(detail.updatedAt)}
        </p>
        {(canUserCloseTicket(detail) || canUserDeleteTicket(detail) || canUserReopenTicket(detail)) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {canUserReopenTicket(detail) ? (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setPendingAction("reopen")}
                className="rounded-lg border border-brand-lime/35 bg-brand-lime/10 px-4 py-2 text-sm font-semibold text-brand-lime transition hover:bg-brand-lime/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reopen request
              </button>
            ) : null}
            {canUserCloseTicket(detail) ? (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setPendingAction("close")}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-white/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Close request
              </button>
            ) : null}
            {canUserDeleteTicket(detail) ? (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setPendingAction("delete")}
                className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete request
              </button>
            ) : null}
          </div>
        )}
      </header>

      <ConfirmDialog
        open={pendingAction === "close"}
        title="Close this request?"
        variant="warning"
        confirmLabel="Close request"
        loading={actionBusy}
        description={
          <>
            You will not be able to add more replies after closing.
            {(detail.creditsCharged ?? 0) > 0 && !detail.creditsRefunded ? (
              <span className="mt-2 block">
                Any website edit credits reserved for this request will be returned to your project.
              </span>
            ) : null}
          </>
        }
        onConfirm={() => void confirmCloseTicket()}
        onCancel={() => !actionBusy && setPendingAction(null)}
      />

      <ConfirmDialog
        open={pendingAction === "delete"}
        title="Delete this request?"
        variant="danger"
        confirmLabel="Delete permanently"
        loading={actionBusy}
        description="This removes the conversation from your requests list. This cannot be undone."
        onConfirm={() => void confirmDeleteTicket()}
        onCancel={() => !actionBusy && setPendingAction(null)}
      />

      <ConfirmDialog
        open={pendingAction === "reopen"}
        title="Reopen this request?"
        confirmLabel="Reopen"
        loading={actionBusy}
        description={
          (detail.creditsCharged ?? 0) > 0 && detail.creditsRefunded ? (
            <>
              Reopening will reserve{" "}
              <span className="font-semibold text-white">{detail.creditsCharged}</span> website edit credits on your
              project again.
            </>
          ) : (
            "You can continue the conversation and add new replies."
          )
        }
        onConfirm={() => void confirmReopenTicket()}
        onCancel={() => !actionBusy && setPendingAction(null)}
      />

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
            <RichTextContent content={m.body} className="mt-3 text-sm text-ink-muted" />
            {(m.attachments?.length ?? 0) > 0 && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Attachments</p>
                <ul className="mt-2 space-y-2">
                  {(m.attachments ?? []).map((attachment) => (
                    <li key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                      <div className="min-w-0">
                        <p className="break-all text-xs text-white">{attachment.fileName}</p>
                        <p className="text-[11px] text-ink-muted">{(attachment.sizeBytes / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void downloadTicketAttachment(attachment.downloadUrl, attachment.fileName)}
                        className="shrink-0 rounded border border-brand-lime/35 bg-brand-lime/10 px-2.5 py-1 text-[11px] font-medium text-brand-lime transition hover:bg-brand-lime/20"
                      >
                        Download
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </section>

      {isTicketReplyable(detail) ? (
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
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-lime px-6 py-2.5 text-sm font-semibold text-canvas shadow-glow transition enabled:hover:scale-[1.02] enabled:hover:bg-brand-lime-dim disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending && <ButtonLoader size="sm" />}
          {sending ? "Sending…" : "Send reply"}
        </button>
      </form>
      ) : (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-ink-muted">
          {detail.status === "closed"
            ? "This request is closed. Reopen it to add more replies."
            : "This request is resolved and cannot receive new replies."}
        </p>
      )}
    </div>
  );
}
