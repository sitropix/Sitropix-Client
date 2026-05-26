import { useEffect, useRef, useState } from "react";
import { SxButton } from "@/components/sx/Button";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";
import {
  listProjectChat,
  markProjectChatRead,
  postProjectChat,
} from "@/services/projectWorkflowApi";
import type { ProjectChatMessage } from "@/types/projectWorkflow";

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function ProjectChat(props: { projectId: string; viewerIsStaff: boolean }) {
  const { projectId, viewerIsStaff } = props;
  const toast = useSxToast();
  const [messages, setMessages] = useState<ProjectChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [markWaiting, setMarkWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const listEndRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      const res = await listProjectChat(projectId);
      setMessages(res.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [projectId]);

  // Auto mark-read as the viewer opens chat.
  useEffect(() => {
    void markProjectChatRead(projectId).catch(() => undefined);
  }, [projectId]);

  // Scroll to latest on new messages.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const trimmed = body.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await postProjectChat(projectId, trimmed, viewerIsStaff ? markWaiting : false);
      setBody("");
      setMarkWaiting(false);
      await refresh();
    } catch (e) {
      toast.error("Couldn't send message.", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SxPanel
      title="Project chat"
      action={
        <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
          {messages.length} message{messages.length === 1 ? "" : "s"}
        </span>
      }
    >
      <div id="project-chat" className="flex flex-col gap-3">
        <div
          className="flex max-h-[420px] flex-col gap-2 overflow-y-auto rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3"
          aria-live="polite"
        >
          {loading ? (
            <p className="text-sx-sm text-[var(--text-tertiary)]">Loading chat…</p>
          ) : messages.length === 0 ? (
            <p className="text-sx-sm text-[var(--text-tertiary)]">
              No messages yet. Say hi — your designer will be notified.
            </p>
          ) : (
            messages.map((m) => {
              const mine = (viewerIsStaff && m.isStaff) || (!viewerIsStaff && !m.isStaff);
              const bubble = mine
                ? "self-end bg-[var(--color-brand-500)] text-white"
                : "self-start bg-white text-[var(--text-primary)] border border-[var(--border-subtle)]";
              return (
                <div key={m.id} className={`max-w-[80%] rounded-sx-md px-3 py-2 text-sx-sm ${bubble}`}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p
                    className={`mt-1 font-mono text-sx-2xs ${mine ? "text-white/80" : "text-[var(--text-tertiary)]"}`}
                  >
                    {m.authorName ?? (m.isStaff ? "Sitropix" : "Customer")} · {fmtTime(m.createdAt)}
                  </p>
                </div>
              );
            })
          )}
          <div ref={listEndRef} />
        </div>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor={`chat-${projectId}`} className="sr-only">
            Message
          </label>
          <textarea
            id={`chat-${projectId}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={viewerIsStaff ? "Reply to the customer…" : "Send a message to your designer…"}
            rows={3}
            disabled={busy}
            className="w-full resize-none rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sx-sm text-[var(--text-primary)] focus:border-[var(--color-brand-500)] focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {viewerIsStaff ? (
              <label className="inline-flex items-center gap-2 text-sx-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={markWaiting}
                  onChange={(e) => setMarkWaiting(e.target.checked)}
                />
                Mark project as waiting for customer reply
              </label>
            ) : (
              <span />
            )}
            <SxButton type="submit" disabled={busy || !body.trim()} loading={busy}>
              Send
            </SxButton>
          </div>
        </form>
      </div>
    </SxPanel>
  );
}
