import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useAuth } from "@/context/AuthContext";
import { useTickets } from "@/hooks/useTickets";
import { useUser } from "@/context/UserContext";
import { listProjectsByUser } from "@/services/projectsStore";
import type { ProjectRecord } from "@/types/project";
import type { TicketPriority } from "@/types/support";

const DEPARTMENTS = [
  { id: "General", label: "General Support" },
  { id: "Technical", label: "Technical Support" },
  { id: "Billing", label: "Billing & Payments" },
  { id: "Sales", label: "Sales" },
  { id: "Account", label: "Account Management" },
];

const PRIORITIES: { id: TicketPriority; label: string; description: string }[] = [
  { id: "low", label: "Low", description: "General inquiry, no urgency" },
  { id: "medium", label: "Medium", description: "Needs attention within a few days" },
  { id: "high", label: "High", description: "Important issue affecting work" },
  { id: "urgent", label: "Urgent", description: "Critical, needs immediate attention" },
];

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

export function SubmitTicketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { submitTicket } = useTickets();
  const { subscription, portal } = useUser();
  const userId = user?.id ?? portal?.user?.id ?? "";
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("General");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [projectId, setProjectId] = useState<string>("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void listProjectsByUser(userId)
      .then((rows) => {
        if (!cancelled) setProjects(rows);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const currentPlan = subscription?.planName ?? "No Active Plan";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const plainText = stripHtml(description);
    if (!subject.trim() || plainText.trim().length < 10) {
      setError("Subject and details (at least 10 characters) are required.");
      return;
    }
    setSubmitting(true);
    try {
      await submitTicket({
        subject: subject.trim(),
        description: description.trim(),
        departmentId: department,
        priority,
        projectId: projectId.trim() || undefined,
        attachments,
      });
      navigate("/requests");
    } catch {
      setError("Could not submit the ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8 opacity-0 animate-fade-up [animation-fill-mode:forwards]">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Submit a ticket" }]} />
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-lime">Support</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Submit a ticket</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Lead with impact and reproduction steps — our routing engine assigns the right pod automatically.
        </p>
      </header>

      <form onSubmit={onSubmit} className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-[#0f1419] to-[#0b0f14] shadow-glass ring-1 ring-white/[0.05]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-lime/60 to-transparent" />
        
        <div className="grid gap-6 p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label htmlFor="subject" className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Subject <span className="text-rose-400">*</span>
              </label>
              <input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-brand-lime/35 focus:ring-2 focus:ring-brand-lime/25"
                placeholder="e.g. Webhooks return 401 after key rotation"
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="department" className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Department <span className="text-rose-400">*</span>
              </label>
              <select
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-brand-lime/35 focus:ring-2 focus:ring-brand-lime/25"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d.id} value={d.id} className="bg-[#0f1419]">
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <label htmlFor="priority" className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Priority <span className="text-rose-400">*</span>
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-brand-lime/35 focus:ring-2 focus:ring-brand-lime/25"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0f1419]">
                    {p.label} — {p.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ticket-project" className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Related project <span className="font-normal text-zinc-500">(optional)</span>
              </label>
              <p className="mt-1 text-[11px] text-ink-muted">
                Link this ticket to a project so our team sees the right context.
              </p>
              <select
                id="ticket-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-brand-lime/35 focus:ring-2 focus:ring-brand-lime/25"
              >
                <option value="">No specific project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0f1419]">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Workspace plan (reference)
              </label>
              <div className="mt-2 flex min-h-[42px] items-center rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
                  <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-brand-lime" />
                  {currentPlan}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Ticket Body <span className="text-rose-400">*</span>
            </label>
            <p className="mt-1 text-xs text-ink-muted">
              Provide details about your issue. Include steps to reproduce, error messages, and any relevant context.
            </p>
            <div className="mt-3">
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="What you expected, what happened, timestamps, request IDs, and any screenshots..."
                minHeight="180px"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ticket-attachments" className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Attach Documents (optional)
            </label>
            <p className="mt-1 text-xs text-ink-muted">
              Add up to 5 files (each up to 12MB). Supported: screenshots, PDFs, logs, and text files.
            </p>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <input
                id="ticket-attachments"
                type="file"
                multiple
                disabled={submitting}
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  setAttachments((prev) => [...prev, ...picked].slice(0, 5));
                  e.currentTarget.value = "";
                }}
                className="w-full text-xs text-ink-muted file:mr-2 file:rounded-lg file:border-0 file:bg-brand-lime file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-canvas"
              />
              {attachments.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {attachments.map((file, idx) => (
                    <li key={`${file.name}-${idx}`} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                      <div className="min-w-0">
                        <p className="break-all text-xs text-white">{file.name}</p>
                        <p className="text-[11px] text-ink-muted">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        className="shrink-0 rounded border border-white/15 px-2 py-1 text-[11px] text-ink-muted transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 bg-black/20 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-xs text-ink-muted">
            By submitting, you agree we may access account metadata needed to resolve this request.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-full bg-brand-lime px-6 py-2.5 text-sm font-semibold text-canvas shadow-glow transition enabled:hover:scale-[1.02] enabled:hover:bg-brand-lime-dim disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Submit ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}
