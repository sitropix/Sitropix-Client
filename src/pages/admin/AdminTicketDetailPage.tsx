import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { RichTextContent } from "@/components/RichTextContent";
import { Skeleton } from "@/components/Skeleton";
import { TicketLinkedMeta } from "@/components/support/TicketLinkedMeta";
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
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxPanel } from "@/components/sx/Panel";
import { SxSelect, SxTextarea } from "@/components/sx/Input";
import { useSxToast } from "@/components/sx/Toast";

type AdminDetail = SupportTicketDetail & {
  user: { id: string; name: string; email: string };
};

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

export function AdminTicketDetailPage() {
  const { id } = useParams();
  const { updateCache } = useAdminPrefetch();
  const toast = useSxToast();
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
      /* best-effort */
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
      toast.success("Reply sent.", "Customer notified.");
    } catch {
      toast.error("Couldn't send reply.", "Try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  async function onStatusSave() {
    if (!id || !statusChoice || !detail || statusChoice === detail.status)
      return;
    setStatusSaving(true);
    try {
      await patchAdminTicketStatus(
        id,
        statusChoice,
        statusChoice === "resolved" ? workCompletedChoice : undefined,
      );
      await reloadTicketAndList();
      toast.success(`Status updated to ${statusChoice.replace("_", " ")}.`);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "ticket_closed") {
        toast.error(
          "Ticket closed by customer.",
          "Only the customer can reopen it.",
        );
      } else {
        toast.error("Couldn't update status.");
      }
    } finally {
      setStatusSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-full max-w-xl" />
        <Skeleton className="h-32 w-full rounded-sx-lg" />
      </div>
    );
  }

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Support Tickets" />;
  }

  if (notFound || !detail) {
    return (
      <div className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8 text-center">
        <h1 className="font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          Ticket not found
        </h1>
        <div className="mt-6">
          <Link to="/admin/tickets">
            <SxButton variant="secondary">Back to tickets</SxButton>
          </Link>
        </div>
      </div>
    );
  }

  const closedByUser = isTicketClosedByUser(detail);
  const shortId = detail.id.slice(-6).toUpperCase();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
            #{shortId}
          </span>
          {statusBadge(detail.status)}
          {detail.priority === "urgent" ? (
            <SxBadge variant="urgent">Urgent</SxBadge>
          ) : null}
        </div>
        <h1 className="font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          {detail.subject}
        </h1>
        <TicketLinkedMeta
          editType={detail.editType}
          addon={detail.addon}
          creditsCharged={detail.creditsCharged}
        />
        <p className="text-sx-sm text-[var(--text-secondary)]">
          Customer:{" "}
          <strong className="text-[var(--text-primary)]">
            {detail.user.name}
          </strong>{" "}
          <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
            &lt;{detail.user.email}&gt;
          </span>
        </p>
        <p className="font-mono text-sx-2xs text-[var(--text-tertiary)]">
          Opened {formatWhen(detail.createdAt)} · last update{" "}
          {formatWhen(detail.updatedAt)}
        </p>
        {(detail.creditsCharged ?? 0) > 0 ? (
          <p className="text-sx-xs text-[var(--color-warning-fg)]">
            Edit credits reserved: {detail.creditsCharged}
            {detail.creditsRefunded ? " (refunded)" : ""}
            {detail.workCompleted === false ? " · marked not completed" : ""}
          </p>
        ) : null}
      </header>

      {closedByUser ? (
        <p className="rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 py-3 text-sx-sm text-[var(--text-secondary)]">
          This ticket was closed by the customer. Only the customer can reopen it.
        </p>
      ) : (
        <SxPanel title="Update status">
          <div className="flex flex-wrap items-end gap-3">
            <SxSelect
              label="Status"
              value={statusChoice}
              onChange={(e) => setStatusChoice(e.target.value as TicketStatus)}
              containerClassName="w-44"
            >
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="hold">On hold</option>
              <option value="resolved">Resolved</option>
            </SxSelect>
            {statusChoice === "resolved" &&
            (detail.creditsCharged ?? 0) > 0 &&
            !detail.creditsRefunded ? (
              <label className="flex max-w-md items-start gap-2 rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sx-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={workCompletedChoice}
                  onChange={(e) => setWorkCompletedChoice(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-brand-500)]"
                />
                <span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    Work completed
                  </span>
                  <span className="block text-sx-2xs">
                    Uncheck if closed without delivery — reserved credits return to the project.
                  </span>
                </span>
              </label>
            ) : null}
            <SxButton
              variant="primary"
              size="sm"
              loading={statusSaving}
              disabled={!statusChoice || statusChoice === detail.status}
              onClick={() => void onStatusSave()}
            >
              {statusSaving ? "Saving…" : "Save status"}
            </SxButton>
          </div>
        </SxPanel>
      )}

      <section className="flex flex-col gap-3" aria-label="Thread">
        {detail.messages.map((m) => (
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
                {m.isStaff ? m.author?.name ?? "Staff" : "Customer"}
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
              content={m.body}
              className="mt-3 text-sx-sm leading-relaxed text-[var(--text-primary)]"
            />
            {(m.attachments?.length ?? 0) > 0 ? (
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
            ) : null}
          </article>
        ))}
      </section>

      <form
        onSubmit={onSend}
        className="flex flex-col gap-3 rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 sm:p-5"
      >
        <SxTextarea
          label="Staff reply"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Your response to the customer…"
        />
        <div className="flex justify-end">
          <SxButton type="submit" loading={sending} disabled={!body.trim()}>
            {sending ? "Sending…" : "Send & notify customer"}
          </SxButton>
        </div>
      </form>
    </div>
  );
}
