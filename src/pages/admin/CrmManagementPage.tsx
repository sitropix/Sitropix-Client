import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  convertCrmLead,
  fetchCrmLeadDetail,
  fetchCrmLeads,
  patchCrmLeadStatus,
} from "@/services/subscriptionsApi";
import type {
  CrmLeadDetailPayload,
  CrmLeadListItem,
  CrmLeadStatus,
} from "@/types/subscription";
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxConfirmDialog } from "@/components/sx/ConfirmDialog";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxInput, SxSelect } from "@/components/sx/Input";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";

const STATUS_LABEL: Record<CrmLeadStatus, string> = {
  NEW: "New",
  MEETING_SCHEDULED: "Meeting scheduled",
  YET_TO_CONTACT: "Yet to contact",
  CONTACTED: "Contacted",
  HOLD: "Hold",
};

const STATUSES: CrmLeadStatus[] = [
  "NEW",
  "YET_TO_CONTACT",
  "CONTACTED",
  "MEETING_SCHEDULED",
  "HOLD",
];

function statusVariant(s: CrmLeadStatus) {
  if (s === "NEW") return "info" as const;
  if (s === "MEETING_SCHEDULED") return "success" as const;
  if (s === "YET_TO_CONTACT") return "warning" as const;
  if (s === "CONTACTED") return "brand" as const;
  return "neutral" as const;
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function payloadToRows(payload: Record<string, unknown>) {
  return Object.entries(payload).map(([k, v]) => ({
    key: k,
    value:
      typeof v === "object" && v !== null ? JSON.stringify(v, null, 2) : String(v ?? ""),
  }));
}

export function CrmManagementPage() {
  const toast = useSxToast();
  const [items, setItems] = useState<CrmLeadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CrmLeadStatus | "">("");
  const [detail, setDetail] = useState<CrmLeadDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [meetingFor, setMeetingFor] = useState<CrmLeadListItem | null>(null);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const res = await fetchCrmLeads({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        limit: 100,
      });
      setItems(res.items);
    } catch {
      toast.error("Couldn't load CRM leads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const d = await fetchCrmLeadDetail(id);
      setDetail(d);
    } catch {
      toast.error("Couldn't load lead detail.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function applyStatus(
    leadId: string,
    toStatus: CrmLeadStatus,
    meetingLink?: string | null,
  ) {
    setBusyId(leadId);
    try {
      await patchCrmLeadStatus(leadId, {
        toStatus,
        meetingLink: meetingLink ?? null,
      });
      await reload();
      if (detail?.lead.id === leadId) await openDetail(leadId);
      toast.success("Lead updated.");
    } catch (err) {
      toast.error(
        "Couldn't update lead.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusyId(null);
    }
  }

  function onStatusSelect(lead: CrmLeadListItem, next: CrmLeadStatus) {
    if (lead.convertedAt) return;
    if (next === "MEETING_SCHEDULED") {
      setMeetingFor(lead);
      setMeetingUrl(lead.meetingLink ?? "");
      return;
    }
    void applyStatus(lead.id, next);
  }

  async function confirmMeeting(e: FormEvent) {
    e.preventDefault();
    if (!meetingFor) return;
    const url = meetingUrl.trim();
    if (!url.startsWith("https://")) {
      toast.warning("Meeting link must use https://");
      return;
    }
    await applyStatus(meetingFor.id, "MEETING_SCHEDULED", url);
    setMeetingFor(null);
    setMeetingUrl("");
  }

  async function onConvert() {
    if (!convertId) return;
    setBusyId(convertId);
    try {
      const res = await convertCrmLead(convertId, { createUserIfNeeded: true });
      toast.success(res.note ?? `Converted (${res.mode}).`);
      setConvertId(null);
      await reload();
      if (detail?.lead.id === convertId) await openDetail(convertId);
    } catch (err) {
      toast.error(
        "Conversion failed.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusyId(null);
    }
  }

  const submissionRows = useMemo(
    () => (detail ? payloadToRows(detail.submission.payloadJson) : []),
    [detail],
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-[var(--border-subtle)] pb-4">
        <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Pipeline
        </p>
        <h1 className="mt-1.5 font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          CRM
        </h1>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">
          Leads from your embedded forms. Update status, view the submission, and convert to a customer when ready.
        </p>
      </header>

      <SxPanel title="Filter">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void reload();
          }}
        >
          <SxInput
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="email, name, company"
            containerClassName="min-w-[220px] flex-1"
          />
          <SxSelect
            label="Status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter((e.target.value as CrmLeadStatus | "") || "")
            }
            containerClassName="min-w-[180px]"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </SxSelect>
          <SxButton type="submit" variant="secondary">
            Apply
          </SxButton>
        </form>
      </SxPanel>

      <SxPanel title={`Leads (${items.length})`} padded={false}>
        {loading ? (
          <p className="p-5 text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
        ) : items.length === 0 ? (
          <div className="p-5">
            <SxEmptyState
              title="No leads."
              description="When someone submits a form, they'll show up here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sx-sm">
              <thead>
                <tr className="bg-[var(--surface-sunken)] text-left">
                  <th className="px-4 py-3 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-medium">
                    Contact
                  </th>
                  <th className="px-4 py-3 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-medium">
                    Form
                  </th>
                  <th className="px-4 py-3 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-medium">
                    Status
                  </th>
                  <th className="px-4 py-3 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-medium">
                    Submitted
                  </th>
                  <th className="px-4 py-3 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const busy = busyId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-sunken)]"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--text-primary)]">
                          {row.fullName ?? "—"}
                        </p>
                        <p className="font-mono text-sx-2xs text-[var(--text-tertiary)]">
                          {row.email ?? "no email"} ·{" "}
                          {row.company ?? "no company"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {row.formName}
                      </td>
                      <td className="px-4 py-3">
                        <SxSelect
                          hideLabel
                          label="Status"
                          value={row.status}
                          disabled={busy || Boolean(row.convertedAt)}
                          onChange={(e) =>
                            onStatusSelect(row, e.target.value as CrmLeadStatus)
                          }
                          containerClassName="min-w-[180px]"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </SxSelect>
                        <div className="mt-1">
                          <SxBadge variant={statusVariant(row.status)}>
                            {STATUS_LABEL[row.status]}
                          </SxBadge>
                          {row.convertedAt ? (
                            <SxBadge variant="success" withDot={false} className="ml-1">
                              Converted
                            </SxBadge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sx-2xs text-[var(--text-tertiary)]">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <SxButton
                            variant="secondary"
                            size="sm"
                            onClick={() => void openDetail(row.id)}
                          >
                            View
                          </SxButton>
                          {!row.convertedAt ? (
                            <SxButton
                              variant="primary"
                              size="sm"
                              onClick={() => setConvertId(row.id)}
                            >
                              Convert
                            </SxButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SxPanel>

      {/* Detail drawer */}
      {detail ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setDetail(null)}
        >
          <div
            role="dialog"
            aria-modal
            className="h-full w-full max-w-lg overflow-y-auto border-l border-[var(--border-default)] bg-[var(--surface-card)] p-6 shadow-sx-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  Lead detail
                </p>
                <h2 className="mt-1 font-ui text-sx-lg font-semibold text-[var(--text-primary)]">
                  {detail.lead.fullName ?? "Unnamed lead"}
                </h2>
                <p className="mt-1 font-mono text-sx-xs text-[var(--text-tertiary)]">
                  {detail.lead.form.name}
                </p>
              </div>
              <SxButton
                variant="ghost"
                size="sm"
                onClick={() => setDetail(null)}
              >
                Close
              </SxButton>
            </div>

            {detailLoading ? (
              <p className="mt-4 text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
            ) : (
              <>
                <dl className="mt-5 grid gap-2 text-sx-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <dt className="text-[var(--text-tertiary)]">Email</dt>
                    <dd className="font-mono text-[var(--text-primary)]">
                      {detail.lead.email ?? "—"}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <dt className="text-[var(--text-tertiary)]">Phone</dt>
                    <dd className="font-mono text-[var(--text-primary)]">
                      {detail.lead.phone ?? "—"}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <dt className="text-[var(--text-tertiary)]">Company</dt>
                    <dd className="text-[var(--text-primary)]">
                      {detail.lead.company ?? "—"}
                    </dd>
                  </div>
                  {detail.lead.meetingLink ? (
                    <div className="grid grid-cols-2 gap-2">
                      <dt className="text-[var(--text-tertiary)]">Meeting</dt>
                      <dd className="truncate">
                        <a
                          href={detail.lead.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-sx-xs text-[var(--text-brand)] hover:underline"
                        >
                          {detail.lead.meetingLink}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <section className="mt-5">
                  <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                    Submission
                  </p>
                  <ul className="mt-2 flex flex-col gap-1 rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3 text-sx-xs">
                    {submissionRows.map((r) => (
                      <li key={r.key} className="grid grid-cols-[120px_1fr] gap-2">
                        <span className="font-mono text-[var(--text-tertiary)]">
                          {r.key}
                        </span>
                        <span className="whitespace-pre-wrap break-words text-[var(--text-primary)]">
                          {r.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="mt-5">
                  <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                    Status history
                  </p>
                  <ul className="mt-2 flex flex-col gap-2 text-sx-xs">
                    {detail.statusLogs.length === 0 ? (
                      <li className="text-[var(--text-tertiary)]">No changes yet.</li>
                    ) : (
                      detail.statusLogs.map((log) => (
                        <li
                          key={log.id}
                          className="rounded-sx-sm border border-[var(--border-subtle)] bg-[var(--surface-card)] p-2"
                        >
                          <p className="text-[var(--text-primary)]">
                            {log.fromStatus ? STATUS_LABEL[log.fromStatus] : "Initial"}{" "}
                            → {STATUS_LABEL[log.toStatus]}
                          </p>
                          <p className="mt-0.5 font-mono text-sx-2xs text-[var(--text-tertiary)]">
                            {formatDate(log.changedAt)}
                            {log.changedBy ? ` · ${log.changedBy.name}` : ""}
                          </p>
                        </li>
                      ))
                    )}
                  </ul>
                </section>

                {!detail.lead.convertedAt ? (
                  <div className="mt-6">
                    <SxButton
                      variant="primary"
                      fullWidth
                      onClick={() => setConvertId(detail.lead.id)}
                    >
                      Convert to customer
                    </SxButton>
                  </div>
                ) : (
                  <div className="mt-6 rounded-sx-md border border-[var(--color-success-500)]/30 bg-[var(--color-success-bg)] p-3 text-sx-sm text-[var(--color-success-fg)]">
                    Converted on {formatDate(detail.lead.convertedAt)} — customer{" "}
                    <strong>{detail.lead.convertedCustomer?.email ?? "linked"}</strong>.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Meeting modal */}
      {meetingFor ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"
          onClick={() => setMeetingFor(null)}
        >
          <div
            role="dialog"
            aria-modal
            className="w-full max-w-md rounded-sx-xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-sx-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={(e) => void confirmMeeting(e)}
              className="p-6"
            >
              <h2 className="font-display text-sx-xl font-semibold text-[var(--text-primary)]">
                Schedule meeting
              </h2>
              <p className="mt-2 text-sx-sm text-[var(--text-secondary)]">
                Add the booking URL for{" "}
                <strong>{meetingFor.fullName ?? meetingFor.email}</strong>.
              </p>
              <div className="mt-4">
                <SxInput
                  label="Meeting URL"
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://cal.com/sitropix/intro"
                  required
                />
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <SxButton
                  type="button"
                  variant="secondary"
                  onClick={() => setMeetingFor(null)}
                >
                  Cancel
                </SxButton>
                <SxButton type="submit">Save meeting</SxButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <SxConfirmDialog
        open={convertId !== null}
        title="Convert this lead to a customer?"
        body="A portal account will be created (or linked if one already exists). The lead is marked converted."
        confirmLabel="Convert"
        loading={busyId === convertId}
        onConfirm={() => void onConvert()}
        onCancel={() => setConvertId(null)}
      />
    </div>
  );
}
