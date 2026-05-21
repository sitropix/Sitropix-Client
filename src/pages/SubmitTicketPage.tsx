import { Breadcrumb } from "@/components/Breadcrumb";
import { portal as portalUi } from "@/components/portal/portalStyles";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { useTickets } from "@/hooks/useTickets";
import {
  addonTicketOptionHint,
  formatAddonRecurringLabel,
} from "@/lib/addonUtilizationDisplay";
import { listProjectsByUser } from "@/services/projectsStore";
import {
  fetchAddonTicketOptions,
  fetchSupportEditTypes,
  messageForTicketSubmitError,
} from "@/services/supportApi";
import type { ProjectRecord } from "@/types/project";
import type {
  AddonTicketOption,
  SupportEditType,
  SupportTicketCategory,
  TicketPriority,
} from "@/types/support";
import {
  DOCUMENT_MAX_BYTES,
  SUPPORT_TICKET_MAX_ATTACHMENTS,
  documentMaxSizeLabelMb,
  filterFilesWithinLimits,
} from "@/lib/documentLimits";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const TICKET_CATEGORIES: {
  id: SupportTicketCategory;
  label: string;
  description: string;
}[] = [
  {
    id: "general",
    label: "General",
    description: "Account, billing, or product questions — no project required",
  },
  {
    id: "edit",
    label: "Edit",
    description: "Website edit request for a project (may use edit credits)",
  },
  {
    id: "addon",
    label: "Add-On",
    description: "Request delivery for a purchased or bundled add-on",
  },
];

const FIELD = "mt-2 w-full " + portalUi.input;
const LABEL = "text-xs font-semibold uppercase tracking-wide text-zinc-600";

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
  const [ticketCategory, setTicketCategory] =
    useState<SupportTicketCategory>("general");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [projectId, setProjectId] = useState<string>("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editTypes, setEditTypes] = useState<SupportEditType[]>([]);
  const [editTypeId, setEditTypeId] = useState<string>("");
  const [addonOptions, setAddonOptions] = useState<AddonTicketOption[]>([]);
  const [addonOptionsLoading, setAddonOptionsLoading] = useState(false);
  const [subscriptionAddonId, setSubscriptionAddonId] = useState("");

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

  useEffect(() => {
    let cancelled = false;
    void fetchSupportEditTypes()
      .then((rows) => {
        if (!cancelled) setEditTypes(rows);
      })
      .catch(() => {
        if (!cancelled) setEditTypes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!projectId.trim()) {
      setEditTypeId("");
      setSubscriptionAddonId("");
      setAddonOptions([]);
    }
  }, [projectId]);

  useEffect(() => {
    if (ticketCategory !== "edit") setEditTypeId("");
    if (ticketCategory !== "addon") setSubscriptionAddonId("");
    if (ticketCategory === "general") setProjectId("");
  }, [ticketCategory]);

  useEffect(() => {
    if (ticketCategory !== "addon" || !projectId.trim()) {
      setAddonOptions([]);
      return;
    }
    let cancelled = false;
    setAddonOptionsLoading(true);
    void fetchAddonTicketOptions(projectId.trim())
      .then((res) => {
        if (!cancelled) {
          setAddonOptions(res.addons.filter((a) => a.eligible));
          setSubscriptionAddonId((prev) => {
            if (prev && res.addons.some((a) => a.id === prev && a.eligible))
              return prev;
            const first = res.addons.find((a) => a.eligible);
            return first?.id ?? "";
          });
        }
      })
      .catch(() => {
        if (!cancelled) setAddonOptions([]);
      })
      .finally(() => {
        if (!cancelled) setAddonOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticketCategory, projectId]);

  const selectedAddon = addonOptions.find((a) => a.id === subscriptionAddonId);
  const projectRequired =
    ticketCategory === "edit" || ticketCategory === "addon";

  const currentPlan = subscription?.planName ?? "No Active Plan";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const plainText = stripHtml(description);
    if (!subject.trim() || plainText.trim().length < 10) {
      setError("Subject and details (at least 10 characters) are required.");
      return;
    }
    if (projectRequired && !projectId.trim()) {
      setError(
        ticketCategory === "addon"
          ? "Select a project for add-on requests."
          : "Select a project for edit requests.",
      );
      return;
    }
    if (ticketCategory === "addon" && !subscriptionAddonId.trim()) {
      setError(
        addonOptions.length === 0
          ? "No eligible add-ons on this project for the current billing cycle."
          : "Select an add-on for this request.",
      );
      return;
    }
    setSubmitting(true);
    try {
      await submitTicket({
        subject: subject.trim(),
        description: description.trim(),
        departmentId: "General",
        priority,
        ticketCategory,
        projectId: projectId.trim() || undefined,
        editTypeId:
          ticketCategory === "edit" && projectId.trim()
            ? editTypeId.trim() || undefined
            : undefined,
        subscriptionAddonId:
          ticketCategory === "addon" && subscriptionAddonId.trim()
            ? subscriptionAddonId.trim()
            : undefined,
        attachments,
      });
      navigate("/requests");
    } catch (err) {
      setError(messageForTicketSubmitError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8 text-zinc-900 opacity-0 animate-fade-up [animation-fill-mode:forwards]">
      <Breadcrumb
        items={[
          { label: "Home", to: "/dashboard" },
          { label: "Submit a ticket" },
        ]}
      />
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
          Support
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Submit a ticket
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
          Lead with impact and reproduction steps — our routing engine assigns
          the right pod automatically.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-glass"
      >
        <div className="grid gap-6 p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label htmlFor="subject" className={LABEL}>
                Subject <span className="text-rose-600">*</span>
              </label>
              <input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={FIELD}
                placeholder="e.g. Webhooks return 401 after key rotation"
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="ticket-category" className={LABEL}>
                Request type <span className="text-rose-600">*</span>
              </label>
              <select
                id="ticket-category"
                value={ticketCategory}
                onChange={(e) =>
                  setTicketCategory(e.target.value as SupportTicketCategory)
                }
                className={FIELD}
              >
                {TICKET_CATEGORIES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-zinc-600">
                {
                  TICKET_CATEGORIES.find((c) => c.id === ticketCategory)
                    ?.description
                }
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {ticketCategory === "general" ? (
              <div>
                <label htmlFor="priority" className={LABEL}>
                  Priority <span className="text-rose-600">*</span>
                </label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className={FIELD}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — {p.description}
                    </option>
                  ))}
                </select>
              </div>
            ) : ticketCategory === "edit" ? (
              <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                  Queue priority
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  Set from your project plan&apos;s{" "}
                  <span className="font-medium text-zinc-900">support channel</span>. If this
                  project includes the{" "}
                  <span className="font-medium text-zinc-900">Rush edit surcharge</span> add-on
                  (with an active subscription), website edit tickets are queued as{" "}
                  <span className="font-medium text-zinc-900">urgent</span> priority
                  automatically.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                  Add-on requests
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  Priority follows your plan support channel. Utilization is tracked per billing
                  cycle — one-time add-ons allow a single completed request per project.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="ticket-project" className={LABEL}>
                Related project{" "}
                {projectRequired ? (
                  <span className="text-rose-600">*</span>
                ) : (
                  <span className="font-normal normal-case text-zinc-500">(optional)</span>
                )}
              </label>
              <p className="mt-1 text-[11px] text-zinc-600">
                {ticketCategory === "general"
                  ? "Not required for general requests."
                  : "Required so we can apply the right subscription and add-on rules."}
              </p>
              <select
                id="ticket-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={FIELD}
              >
                <option value="">
                  {projectRequired ? "Select a project…" : "No specific project"}
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {ticketCategory === "edit" && projectId.trim() ? (
              <div>
                <label htmlFor="ticket-edit-type" className={LABEL}>
                  Type of website edit{" "}
                  <span className="font-normal normal-case text-zinc-500">
                    (optional — billable edits only)
                  </span>
                </label>
                <p className="mt-1 text-[11px] text-zinc-600">
                  Select an edit type only when this ticket should consume website edit credits
                  from this project&apos;s subscription. Leave unselected for general project
                  context. Credits are reserved when the ticket is created; insufficient credits
                  are rejected.
                </p>
                <select
                  id="ticket-edit-type"
                  value={editTypeId}
                  onChange={(e) => setEditTypeId(e.target.value)}
                  className={FIELD}
                >
                  <option value="">Select an edit type…</option>
                  {editTypes.map((et) => (
                    <option key={et.id} value={et.id}>
                      {et.label} — {et.defaultChargeCredits} credit
                      {et.defaultChargeCredits === 1 ? "" : "s"}
                      {et.creditsMin !== et.creditsMax
                        ? ` (range ${et.creditsMin}–${et.creditsMax})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {ticketCategory === "addon" && projectId.trim() ? (
              <div className="lg:col-span-2">
                <label htmlFor="ticket-addon" className={LABEL}>
                  Add-on <span className="text-rose-600">*</span>
                </label>
                <p className="mt-1 text-[11px] text-zinc-600">
                  Only add-ons active on this project and eligible in the current billing cycle
                  are listed. One-time add-ons allow a single completed request per project;
                  recurring add-ons reset after each successful renewal.
                </p>
                <select
                  id="ticket-addon"
                  value={subscriptionAddonId}
                  onChange={(e) => setSubscriptionAddonId(e.target.value)}
                  disabled={addonOptionsLoading || addonOptions.length === 0}
                  className={FIELD}
                >
                  <option value="">
                    {addonOptionsLoading
                      ? "Loading add-ons…"
                      : addonOptions.length === 0
                        ? "No eligible add-ons for this cycle"
                        : "Select an add-on…"}
                  </option>
                  {addonOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {formatAddonRecurringLabel(a)}
                      {a.isBundled ? " (plan)" : ""}
                    </option>
                  ))}
                </select>
                {selectedAddon && (
                  <p className="mt-2 text-xs text-zinc-600">
                    {addonTicketOptionHint(selectedAddon)}
                  </p>
                )}
                {!addonOptionsLoading &&
                  projectId.trim() &&
                  addonOptions.length === 0 && (
                    <p className="mt-2 text-xs text-amber-800">
                      All purchased add-ons for this project are either already used (one-time),
                      consumed this billing cycle, or awaiting payment. Check your project
                      subscription or billing page.
                    </p>
                  )}
              </div>
            ) : null}

            <div>
              <label className={LABEL}>Workspace plan (reference)</label>
              <div className="mt-2 flex min-h-[42px] items-center rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2">
                <span className="inline-flex items-center gap-2 text-sm text-zinc-700">
                  <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-accent-gold" />
                  {currentPlan}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className={LABEL}>
              Ticket Body <span className="text-rose-600">*</span>
            </label>
            <p className="mt-1 text-xs text-zinc-600">
              Provide details about your issue. Include steps to reproduce, error messages, and
              any relevant context.
            </p>
            <div className="mt-3">
              <RichTextEditor
                variant="portal"
                value={description}
                onChange={setDescription}
                placeholder="What you expected, what happened, timestamps, request IDs, and any screenshots..."
                minHeight="180px"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ticket-attachments" className={LABEL}>
              Attach Documents (optional)
            </label>
            <p className="mt-1 text-xs text-zinc-600">
              Add up to {SUPPORT_TICKET_MAX_ATTACHMENTS} files (each up to{" "}
              {documentMaxSizeLabelMb()}). Supported: images, PDFs, and text documents.
            </p>
            <div className="mt-3 rounded-xl border border-zinc-300 bg-zinc-50 p-3">
              <input
                id="ticket-attachments"
                type="file"
                multiple
                disabled={submitting}
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  setAttachments((prev) => {
                    const { accepted, rejected } = filterFilesWithinLimits(
                      picked,
                      prev,
                      {
                        maxCount: SUPPORT_TICKET_MAX_ATTACHMENTS,
                        maxBytes: DOCUMENT_MAX_BYTES,
                      },
                    );
                    if (rejected.length > 0) {
                      setError(rejected[0]);
                    }
                    return accepted;
                  });
                  e.currentTarget.value = "";
                }}
                className="w-full text-xs text-zinc-700 file:mr-2 file:rounded-lg file:border-0 file:bg-accent-gold file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
              {attachments.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {attachments.map((file, idx) => (
                    <li
                      key={`${file.name}-${idx}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-zinc-300 bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="break-all text-xs text-zinc-900">{file.name}</p>
                        <p className="text-[11px] text-zinc-600">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          setAttachments((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
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
            <div className="rounded-xl border border-rose-400/40 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 border-t border-zinc-300 bg-zinc-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-xs text-zinc-600">
            By submitting, you agree we may access account metadata needed to resolve this
            request.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className={
              portalUi.btnPrimary + " shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {submitting ? "Sending…" : "Submit ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}
