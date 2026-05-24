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
import { useNavigate, useSearchParams } from "react-router-dom";
import { SxButton } from "@/components/sx/Button";
import { SxInput, SxSelect } from "@/components/sx/Input";
import { SxPageHeader } from "@/components/sx/PageHeader";
import { SxPanel } from "@/components/sx/Panel";
import { SxSegmentedControl } from "@/components/sx/SegmentedControl";
import { SxBadge } from "@/components/sx/Badge";

const TICKET_CATEGORIES: {
  id: SupportTicketCategory;
  label: string;
  description: string;
}[] = [
  {
    id: "general",
    label: "General",
    description: "Account, billing, or product question — no project needed.",
  },
  {
    id: "edit",
    label: "Edit",
    description: "Website change for a project. Uses edit credits.",
  },
  {
    id: "addon",
    label: "Add-on",
    description: "Request work covered by a purchased or bundled add-on.",
  },
];

const PRIORITIES: { id: TicketPriority; label: string; description: string }[] = [
  { id: "low", label: "Low", description: "Whenever you can." },
  { id: "medium", label: "Medium", description: "Within a few days." },
  { id: "high", label: "High", description: "Affecting work — soon." },
  { id: "urgent", label: "Urgent", description: "Site down or near-down." },
];

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

export function SubmitTicketPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
    const category = searchParams.get("category");
    const project = searchParams.get("projectId");
    const addonId = searchParams.get("subscriptionAddonId");
    if (category === "general" || category === "edit" || category === "addon") {
      setTicketCategory(category);
    }
    if (project?.trim()) setProjectId(project.trim());
    if (addonId?.trim()) setSubscriptionAddonId(addonId.trim());
  }, [searchParams]);

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

  const currentPlan = subscription?.planName ?? "No active plan";
  const categoryDesc =
    TICKET_CATEGORIES.find((c) => c.id === ticketCategory)?.description ?? "";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const plainText = stripHtml(description);
    if (!subject.trim() || plainText.trim().length < 10) {
      setError("Add a subject and at least 10 characters of detail.");
      return;
    }
    if (projectRequired && !projectId.trim()) {
      setError(
        ticketCategory === "addon"
          ? "Pick a project for the add-on request."
          : "Pick a project for the edit request.",
      );
      return;
    }
    if (ticketCategory === "addon" && !subscriptionAddonId.trim()) {
      setError(
        addonOptions.length === 0
          ? "No eligible add-ons on this project for the current billing cycle."
          : "Pick an add-on for this request.",
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
      navigate("/tickets");
    } catch (err) {
      setError(messageForTicketSubmitError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div data-sx-root className="flex flex-col gap-6">
      <SxPageHeader
        title="New ticket"
        description="Tell us what you need. We handle the work — copy, layout, images, publishing."
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <SxPanel title="What can we help with?">
          <div className="flex flex-col gap-5">
            <SxSegmentedControl<SupportTicketCategory>
              ariaLabel="Request type"
              fullWidth
              options={TICKET_CATEGORIES.map((c) => ({
                value: c.id,
                label: c.label,
              }))}
              value={ticketCategory}
              onChange={(v) => setTicketCategory(v)}
            />
            <p className="text-sx-xs text-[var(--text-tertiary)]">
              {categoryDesc}
            </p>

            <SxInput
              label="Subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Update homepage hero photo"
              autoComplete="off"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              {ticketCategory === "general" ? (
                <SxSelect
                  label="Priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  helpText="How fast do you need this?"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — {p.description}
                    </option>
                  ))}
                </SxSelect>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-sx-xs font-semibold text-[var(--text-primary)]">
                    Queue priority
                  </label>
                  <div className="rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sx-xs leading-relaxed text-[var(--text-secondary)]">
                    {ticketCategory === "edit"
                      ? "Set from your project plan's support channel. The Rush edit surcharge add-on (if active) makes edits urgent automatically."
                      : "Priority follows your plan support channel. Utilization tracks per billing cycle."}
                  </div>
                </div>
              )}

              <SxSelect
                label={projectRequired ? "Related project" : "Related project (optional)"}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                helpText={
                  ticketCategory === "general"
                    ? "Not needed for general questions."
                    : "Required so we can apply the right plan rules."
                }
              >
                <option value="">
                  {projectRequired ? "Pick a project…" : "No specific project"}
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SxSelect>
            </div>

            {ticketCategory === "edit" && projectId.trim() ? (
              <SxSelect
                label="Type of edit (optional)"
                value={editTypeId}
                onChange={(e) => setEditTypeId(e.target.value)}
                helpText="Pick one if this should consume edit credits. Leave blank for general project context."
              >
                <option value="">Don't charge edit credits</option>
                {editTypes.map((et) => (
                  <option key={et.id} value={et.id}>
                    {et.label} — {et.defaultChargeCredits} credit
                    {et.defaultChargeCredits === 1 ? "" : "s"}
                    {et.creditsMin !== et.creditsMax
                      ? ` (${et.creditsMin}–${et.creditsMax})`
                      : ""}
                  </option>
                ))}
              </SxSelect>
            ) : null}

            {ticketCategory === "addon" && projectId.trim() ? (
              <SxSelect
                label="Add-on"
                required
                value={subscriptionAddonId}
                onChange={(e) => setSubscriptionAddonId(e.target.value)}
                disabled={addonOptionsLoading || addonOptions.length === 0}
                helpText={
                  selectedAddon
                    ? addonTicketOptionHint(selectedAddon)
                    : "Only add-ons active on this project and eligible this cycle are listed."
                }
              >
                <option value="">
                  {addonOptionsLoading
                    ? "Loading add-ons…"
                    : addonOptions.length === 0
                      ? "No eligible add-ons this cycle"
                      : "Pick an add-on…"}
                </option>
                {addonOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {formatAddonRecurringLabel(a)}
                    {a.isBundled ? " (plan)" : ""}
                  </option>
                ))}
              </SxSelect>
            ) : null}

            {ticketCategory === "addon" &&
            !addonOptionsLoading &&
            projectId.trim() &&
            addonOptions.length === 0 ? (
              <div className="rounded-sx-md border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-bg)] px-3 py-2 text-sx-xs text-[var(--color-warning-fg)]">
                All add-ons for this project are used this cycle, awaiting payment, or one-time and already completed. Check the project's billing page.
              </div>
            ) : null}

            <div className="flex items-center gap-2 rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sx-xs text-[var(--text-secondary)]">
              <SxBadge variant="brand">Plan</SxBadge>
              <span>{currentPlan}</span>
            </div>
          </div>
        </SxPanel>

        <SxPanel title="Details">
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sx-xs font-semibold text-[var(--text-primary)]">
                What needs to happen?
              </label>
              <p className="mt-1 text-sx-xs text-[var(--text-tertiary)]">
                The more specific, the faster we can ship.
              </p>
              <div className="mt-3">
                <RichTextEditor
                  variant="portal"
                  value={description}
                  onChange={setDescription}
                  placeholder="Describe the change you want. Include URLs, copy, image notes — anything helpful."
                  minHeight="180px"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="ticket-attachments"
                className="text-sx-xs font-semibold text-[var(--text-primary)]"
              >
                Attachments (optional)
              </label>
              <p className="mt-1 text-sx-xs text-[var(--text-tertiary)]">
                Up to {SUPPORT_TICKET_MAX_ATTACHMENTS} files,{" "}
                {documentMaxSizeLabelMb()} each. Images, PDFs, text documents.
              </p>
              <div className="mt-3 rounded-sx-md border border-dashed border-[var(--border-default)] bg-[var(--surface-sunken)] p-3">
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
                      if (rejected.length > 0) setError(rejected[0]);
                      return accepted;
                    });
                    e.currentTarget.value = "";
                  }}
                  className="w-full text-sx-xs text-[var(--text-secondary)] file:mr-2 file:rounded-sx-sm file:border-0 file:bg-[var(--color-brand-500)] file:px-3 file:py-1.5 file:text-sx-xs file:font-semibold file:text-white"
                />
                {attachments.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {attachments.map((file, idx) => (
                      <li
                        key={`${file.name}-${idx}`}
                        className="flex items-start justify-between gap-3 rounded-sx-sm border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="break-all text-sx-xs text-[var(--text-primary)]">
                            {file.name}
                          </p>
                          <p className="text-sx-2xs text-[var(--text-tertiary)]">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                        <SxButton
                          variant="ghost"
                          size="sm"
                          disabled={submitting}
                          onClick={() =>
                            setAttachments((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                        >
                          Remove
                        </SxButton>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>
        </SxPanel>

        {error ? (
          <div
            role="alert"
            className="rounded-sx-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-sx-sm text-[var(--color-danger-fg)]"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sx-xs text-[var(--text-tertiary)]">
            We may use your account details to deliver this request.
          </p>
          <SxButton type="submit" loading={submitting}>
            {submitting ? "Sending…" : "Submit ticket"}
          </SxButton>
        </div>
      </form>
    </div>
  );
}
