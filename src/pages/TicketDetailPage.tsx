import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { RichTextContent } from "@/components/RichTextContent";
import { Skeleton } from "@/components/Skeleton";
import { TicketLinkedMetaLight } from "@/components/support/TicketLinkedMetaLight";
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
import type {
  SupportTicketDetail,
  TicketMessageView,
  TicketStatus,
} from "@/types/support";
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxConfirmDialog } from "@/components/sx/ConfirmDialog";
import { SxTextarea } from "@/components/sx/Input";
import { useSxToast } from "@/components/sx/Toast";

type PendingAction = "close" | "delete" | "reopen" | null;

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusBadge(status: TicketStatus) {
  if (status === "open") return <SxBadge variant="open">Open</SxBadge>;
  if (status === "in_progress")
    return <SxBadge variant="progress">In progress</SxBadge>;
  if (status === "hold") return <SxBadge variant="warning">On hold</SxBadge>;
  if (status === "resolved")
    return <SxBadge variant="resolved">Resolved</SxBadge>;
  if (status === "closed") return <SxBadge variant="closed">Closed</SxBadge>;
  return <SxBadge>{status}</SxBadge>;
}

export function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { reload: reloadTickets } = useTickets();
  const toast = useSxToast();
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
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          if (e instanceof ApiRequestError && e.status === 404)
            setNotFound(true);
          else setLoadError("Couldn't load this ticket.");
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
        toast.success(
          "Ticket closed.",
          "Reserved edit credits were returned to your project.",
        );
      } else {
        toast.success("Ticket closed.");
      }
      setPendingAction(null);
    } catch {
      toast.error("Couldn't close this ticket.", "Try again in a moment.");
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
      toast.success("Ticket deleted.");
      setPendingAction(null);
      navigate("/tickets", { replace: true });
    } catch {
      toast.error("Couldn't delete this ticket.", "Try again in a moment.");
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
      toast.success("Ticket reopened.", "You can add replies again.");
      setPendingAction(null);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "insufficient_credits") {
        toast.error(
          "Not enough edit credits.",
          "Buy more credits from your project dashboard, then reopen.",
        );
      } else {
        toast.error("Couldn't reopen this ticket.", "Try again in a moment.");
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
      toast.success("Reply sent.");
    } catch {
      toast.error("Couldn't send your message.", "Try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div data-sx-root className="flex flex-col gap-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (loadError && !detail) {
    return (
      <div
        data-sx-root
        className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center"
      >
        <h1 className="font-display text-sx-xl font-medium text-[var(--text-primary)]">
          {loadError}
        </h1>
        <p className="mt-2 text-sx-sm text-[var(--text-secondary)]">
          Check your connection, then retry.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <SxButton
            variant="primary"
            loading={retryBusy}
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
                  if (e instanceof ApiRequestError && e.status === 404)
                    setNotFound(true);
                  else setLoadError("Couldn't load this ticket.");
                } finally {
                  setLoading(false);
                  setRetryBusy(false);
                }
              })();
            }}
          >
            {retryBusy ? "Retrying…" : "Retry"}
          </SxButton>
          <Link to="/tickets">
            <SxButton variant="secondary">Back to tickets</SxButton>
          </Link>
        </div>
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div
        data-sx-root
        className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center"
      >
        <h1 className="font-display text-sx-xl font-medium text-[var(--text-primary)]">
          Ticket not found
        </h1>
        <p className="mt-2 text-sx-sm text-[var(--text-secondary)]">
          The link may be outdated or the ticket may have been removed.
        </p>
        <div className="mt-6">
          <Link to="/tickets">
            <SxButton variant="secondary">Back to tickets</SxButton>
          </Link>
        </div>
      </div>
    );
  }

  const shortId = detail.id.slice(-6).toUpperCase();

  return (
    <div data-sx-root className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 border-b border-[var(--border-subtle)] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
            #{shortId}
          </span>
          {statusBadge(detail.status)}
          {detail.priority === "urgent" ? (
            <SxBadge variant="urgent">Urgent</SxBadge>
          ) : null}
          {detail.department ? (
            <SxBadge variant="neutral" withDot={false}>
              {detail.department}
            </SxBadge>
          ) : null}
        </div>
        <h1 className="font-display text-sx-xl font-medium leading-tight text-[var(--text-primary)] [letter-spacing:var(--tracking-tight)] sm:text-sx-2xl">
          {detail.subject}
        </h1>
        <TicketLinkedMetaLight editType={detail.editType} addon={detail.addon} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sx-xs text-[var(--text-tertiary)]">
          <span>Opened {formatWhen(detail.createdAt)}</span>
          <span>·</span>
          <span>Last update {formatWhen(detail.updatedAt)}</span>
          {(detail.creditsCharged ?? 0) > 0 ? (
            <>
              <span>·</span>
              <span>
                {detail.creditsCharged} edit credit
                {detail.creditsCharged === 1 ? "" : "s"} reserved
              </span>
            </>
          ) : null}
        </div>
        {detail.projectName && detail.projectId ? (
          <p className="text-sx-sm text-[var(--text-secondary)]">
            Project:{" "}
            <Link
              to={`/projects/${detail.projectId}`}
              className="font-semibold text-[var(--text-brand)] hover:underline"
            >
              {detail.projectName}
            </Link>
          </p>
        ) : null}

        {(canUserCloseTicket(detail) ||
          canUserDeleteTicket(detail) ||
          canUserReopenTicket(detail)) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {canUserReopenTicket(detail) ? (
              <SxButton
                variant="secondary"
                size="sm"
                disabled={actionBusy}
                onClick={() => setPendingAction("reopen")}
              >
                Reopen ticket
              </SxButton>
            ) : null}
            {canUserCloseTicket(detail) ? (
              <SxButton
                variant="secondary"
                size="sm"
                disabled={actionBusy}
                onClick={() => setPendingAction("close")}
              >
                Close ticket
              </SxButton>
            ) : null}
            {canUserDeleteTicket(detail) ? (
              <SxButton
                variant="ghost"
                size="sm"
                className="!text-[var(--color-danger-fg)]"
                disabled={actionBusy}
                onClick={() => setPendingAction("delete")}
              >
                Delete
              </SxButton>
            ) : null}
          </div>
        )}
      </header>

      <SxConfirmDialog
        open={pendingAction === "close"}
        title="Close this ticket?"
        confirmLabel="Close ticket"
        loading={actionBusy}
        body={
          <>
            You won't be able to add more replies after closing.
            {(detail.creditsCharged ?? 0) > 0 && !detail.creditsRefunded ? (
              <span className="mt-2 block">
                Any reserved edit credits return to your project.
              </span>
            ) : null}
          </>
        }
        onConfirm={() => void confirmCloseTicket()}
        onCancel={() => !actionBusy && setPendingAction(null)}
      />

      <SxConfirmDialog
        open={pendingAction === "delete"}
        title="Delete this ticket?"
        confirmLabel="Delete permanently"
        destructive
        loading={actionBusy}
        body="This removes the conversation from your tickets list. This can't be undone."
        onConfirm={() => void confirmDeleteTicket()}
        onCancel={() => !actionBusy && setPendingAction(null)}
      />

      <SxConfirmDialog
        open={pendingAction === "reopen"}
        title="Reopen this ticket?"
        confirmLabel="Reopen"
        loading={actionBusy}
        body={
          (detail.creditsCharged ?? 0) > 0 && detail.creditsRefunded ? (
            <>
              Reopening reserves{" "}
              <strong>{detail.creditsCharged}</strong> edit credit
              {detail.creditsCharged === 1 ? "" : "s"} again.
            </>
          ) : (
            "You'll be able to add new replies."
          )
        }
        onConfirm={() => void confirmReopenTicket()}
        onCancel={() => !actionBusy && setPendingAction(null)}
      />

      <section className="flex flex-col gap-3" aria-label="Conversation">
        {detail.messages.map((m: TicketMessageView) => (
          <article
            key={m.id}
            className={[
              "rounded-sx-lg border bg-[var(--surface-card)] p-4 sm:p-5",
              m.isStaff
                ? "border-[var(--border-subtle)] border-l-4 border-l-[var(--color-brand-500)]"
                : "border-[var(--border-subtle)]",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-ui text-sx-sm font-semibold text-[var(--text-primary)]">
                {m.isStaff ? "Sitropix" : m.author?.name ?? "You"}
                {m.isStaff ? (
                  <SxBadge
                    className="ml-2 align-middle"
                    variant="brand"
                    withDot={false}
                  >
                    Staff
                  </SxBadge>
                ) : null}
              </p>
              <time
                className="font-mono text-sx-2xs text-[var(--text-tertiary)]"
                dateTime={m.createdAt}
              >
                {formatWhen(m.createdAt)}
              </time>
            </div>
            <RichTextContent
              variant="portal"
              content={m.body}
              className="mt-3 text-sx-sm leading-relaxed text-[var(--text-primary)]"
            />
            {(m.attachments?.length ?? 0) > 0 && (
              <div className="mt-4 rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
                <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  Attachments
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {(m.attachments ?? []).map((attachment) => (
                    <li
                      key={attachment.id}
                      className="flex items-center justify-between gap-3 rounded-sx-sm border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="break-all text-sx-xs text-[var(--text-primary)]">
                          {attachment.fileName}
                        </p>
                        <p className="font-mono text-sx-2xs text-[var(--text-tertiary)]">
                          {(attachment.sizeBytes / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <SxButton
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          void downloadTicketAttachment(
                            attachment.downloadUrl,
                            attachment.fileName,
                          )
                        }
                      >
                        Download
                      </SxButton>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </section>

      {isTicketReplyable(detail) ? (
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 sm:p-5"
        >
          <SxTextarea
            label="Add a reply"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="More context, screenshots links, or questions…"
          />
          <div className="flex justify-end">
            <SxButton
              type="submit"
              loading={sending}
              disabled={!body.trim()}
            >
              {sending ? "Sending…" : "Send reply"}
            </SxButton>
          </div>
        </form>
      ) : (
        <p className="rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 py-3 text-sx-sm text-[var(--text-secondary)]">
          {detail.status === "closed"
            ? "This ticket is closed. Reopen it to add more replies."
            : "This ticket is resolved and can't receive new replies."}
        </p>
      )}
    </div>
  );
}
