import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ButtonLoader } from "@/components/ButtonLoader";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { RichTextContent } from "@/components/RichTextContent";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import { isTicketClosedByUser } from "@/lib/supportTicketLifecycle";
import { ApiRequestError, isModuleForbiddenError } from "@/services/http";
import {
  downloadTicketAttachment,
  fetchAdminTicketById,
  patchAdminTicketStatus,
  postAdminTicketReply,
  refreshAdminTicketsList,
} from "@/services/supportApi";
import type { SupportTicketDetail, TicketStatus } from "@/types/support";

type AdminDetail = SupportTicketDetail & { user: { id: string; name: string; email: string } };

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function AdminTicketDetailPage() {
  const { id } = useParams();
  const { updateCache } = useAdminPrefetch();
  const { showSuccess, showError } = useToast();
  const [detail, setDetail] = useState<AdminDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusChoice, setStatusChoice] = useState<TicketStatus | "">("");
  const [workCompletedChoice, setWorkCompletedChoice] = useState(true);
  const [noModuleAccess, setNoModuleAccess] = useState(false);

  async function reload() {
    if (!id) return;
    const d = await fetchAdminTicketById(id);
    setDetail(d);
    setStatusChoice(d.status);
    setWorkCompletedChoice(d.workCompleted !== false);
  }

  async function reloadTicketAndList() {
    await reload();
    try {
      const r = await refreshAdminTicketsList();
      updateCache({ tickets: r.items });
    } catch {
      /* list refresh is best-effort */
    }
  }

  useEffect(() => {
    if (id === undefined) return;
    const ticketId = id;
    let cancelled = false;
    async function run() {
      setLoading(true);
      setNotFound(false);
      setNoModuleAccess(false);
      try {
        const d = await fetchAdminTicketById(ticketId);
        if (!cancelled) {
          setDetail(d);
          setStatusChoice(d.status);
          setWorkCompletedChoice(d.workCompleted !== false);
        }
      } catch (err) {
        if (!cancelled) {
          if (isModuleForbiddenError(err)) {
            setNoModuleAccess(true);
          } else {
            setNotFound(true);
            setDetail(null);
          }
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
    setSending(true);
    try {
      const r = await postAdminTicketReply(id, body.trim());
      setBody("");
      await reloadTicketAndList();
      if (r.status && detail) {
        setStatusChoice(r.status as TicketStatus);
      }
      showSuccess("Reply sent and customer notified.");
    } catch {
      showError("Could not send reply. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function onStatusSave() {
    if (!id || !statusChoice || !detail || statusChoice === detail.status) return;
    setStatusSaving(true);
    try {
      await patchAdminTicketStatus(
        id,
        statusChoice,
        statusChoice === "resolved" ? workCompletedChoice : undefined,
      );
      await reloadTicketAndList();
      showSuccess(`Ticket status updated to "${statusChoice.replace("_", " ")}".`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "ticket_closed") {
        showError("This ticket was closed by the customer. Only they can reopen it.");
      } else {
        showError("Could not update status. Please try again.");
      }
    } finally {
      setStatusSaving(false);
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

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Support Tickets" />;
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
        {(detail.creditsCharged ?? 0) > 0 && (
          <p className="text-xs text-amber-200/90">
            Website edit credits reserved: {detail.creditsCharged}
            {detail.creditsRefunded ? " (refunded)" : ""}
            {detail.workCompleted === false ? " — marked not completed" : ""}
          </p>
        )}
        {isTicketClosedByUser(detail) ? (
          <p className="mt-4 max-w-xl rounded-lg border border-zinc-500/30 bg-zinc-500/10 px-4 py-3 text-sm text-ink-muted">
            This request was <span className="font-semibold text-white">closed by the customer</span>. Status cannot be
            changed here — only the customer can reopen it.
          </p>
        ) : (
        <div className="mt-4 flex flex-wrap items-end gap-4">
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
              <option value="hold">Hold</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          {statusChoice === "resolved" && (detail.creditsCharged ?? 0) > 0 && !detail.creditsRefunded ? (
            <label className="flex max-w-md items-start gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={workCompletedChoice}
                onChange={(e) => setWorkCompletedChoice(e.target.checked)}
                className="mt-0.5 accent-brand-lime"
              />
              <span>
                <span className="font-semibold text-white">Work completed</span>
                <span className="block text-[11px] text-ink-muted">
                  Uncheck if the request was closed without delivering the edit — reserved credits are returned to the
                  project once.
                </span>
              </span>
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => void onStatusSave()}
            disabled={statusSaving || statusChoice === detail.status}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white transition enabled:hover:border-brand-lime/35 disabled:opacity-40"
          >
            {statusSaving && <ButtonLoader size="sm" />}
            {statusSaving ? "Saving…" : "Save status"}
          </button>
        </div>
        )}
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
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-lime px-6 py-2.5 text-sm font-semibold text-canvas disabled:opacity-60"
        >
          {sending && <ButtonLoader size="sm" />}
          {sending ? "Sending…" : "Send and notify customer"}
        </button>
      </form>
    </div>
  );
}
