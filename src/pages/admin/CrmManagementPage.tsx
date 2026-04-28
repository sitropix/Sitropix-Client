import { FormEvent, useEffect, useState } from "react";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { ApiRequestError, isModuleForbiddenError } from "@/services/http";
import {
  convertCrmLead,
  fetchCrmLeadDetail,
  fetchCrmLeads,
  patchCrmLeadStatus,
} from "@/services/subscriptionsApi";
import type { CrmLeadDetailPayload, CrmLeadListItem, CrmLeadStatus } from "@/types/subscription";

const STATUS_LABEL: Record<CrmLeadStatus, string> = {
  NEW: "New",
  MEETING_SCHEDULED: "Meeting scheduled",
  YET_TO_CONTACT: "Yet to contact",
  CONTACTED: "Contacted",
  HOLD: "Hold",
};

const STATUSES: CrmLeadStatus[] = ["NEW", "MEETING_SCHEDULED", "YET_TO_CONTACT", "CONTACTED", "HOLD"];

function formatPayload(payload: Record<string, unknown>) {
  return Object.entries(payload).map(([k, v]) => ({
    key: k,
    value: typeof v === "object" ? JSON.stringify(v) : String(v ?? ""),
  }));
}

export function CrmManagementPage() {
  const [items, setItems] = useState<CrmLeadListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CrmLeadStatus | "">("");
  const [notice, setNotice] = useState<string | null>(null);
  const [noModuleAccess, setNoModuleAccess] = useState(false);
  const [detail, setDetail] = useState<CrmLeadDetailPayload | null>(null);
  const [meetingModalLeadId, setMeetingModalLeadId] = useState<string | null>(null);
  const [meetingUrlInput, setMeetingUrlInput] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetchCrmLeads({
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      limit: 100,
    });
    setItems(res.items);
    setTotal(res.total);
  }

  useEffect(() => {
    void load().catch((err) => {
      if (isModuleForbiddenError(err)) setNoModuleAccess(true);
      else setNotice("Could not load CRM leads.");
    });
  }, []);

  async function applySearch(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      await load();
    } catch {
      setNotice("Search failed.");
    }
  }

  async function openDetail(id: string) {
    setNotice(null);
    try {
      const d = await fetchCrmLeadDetail(id);
      setDetail(d);
    } catch {
      setNotice("Could not load lead detail.");
    }
  }

  async function applyStatus(leadId: string, toStatus: CrmLeadStatus, meetingLink?: string | null) {
    setBusyId(leadId);
    setNotice(null);
    try {
      await patchCrmLeadStatus(leadId, { toStatus, meetingLink: meetingLink ?? null });
      await load();
      if (detail?.lead.id === leadId) await openDetail(leadId);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : "Update failed.";
      setNotice(msg);
    } finally {
      setBusyId(null);
    }
  }

  function onStatusSelect(lead: CrmLeadListItem, next: CrmLeadStatus) {
    if (lead.convertedAt) return;
    if (next === "MEETING_SCHEDULED") {
      setMeetingModalLeadId(lead.id);
      setMeetingUrlInput(lead.meetingLink ?? "");
      return;
    }
    void applyStatus(lead.id, next);
  }

  async function confirmMeetingScheduled() {
    if (!meetingModalLeadId) return;
    const url = meetingUrlInput.trim();
    if (!url.startsWith("https://")) {
      setNotice("Meeting link must be HTTPS.");
      return;
    }
    await applyStatus(meetingModalLeadId, "MEETING_SCHEDULED", url);
    setMeetingModalLeadId(null);
    setMeetingUrlInput("");
  }

  async function onConvert(leadId: string) {
    if (!window.confirm("Convert this lead to a portal customer user?")) return;
    setBusyId(leadId);
    setNotice(null);
    try {
      const res = await convertCrmLead(leadId, { createUserIfNeeded: true });
      setNotice(res.note ?? `Converted (${res.mode}).`);
      await load();
      await openDetail(leadId);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : "Conversion failed.";
      setNotice(msg);
    } finally {
      setBusyId(null);
    }
  }

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="CRM" />;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-white">CRM</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Lead responses from embedded forms. Update status, review submissions, convert to customers.
        </p>
      </header>

      {notice ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-200">{notice}</p>
      ) : null}

      <form onSubmit={applySearch} className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-neutral-500">Search</span>
          <input
            className="mt-1 block w-64 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Email, name, company"
          />
        </label>
        <label className="text-sm">
          <span className="text-neutral-500">Status</span>
          <select
            className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter((e.target.value as CrmLeadStatus | "") || "")}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-brand-lime px-4 py-2 text-sm font-bold text-canvas">
          Apply
        </button>
      </form>

      <div className="rounded-2xl border border-white/10 bg-[#15191C] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-neutral-400">
              <tr>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Form</th>
                <th className="px-4 py-3">Name / Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Meeting</th>
                <th className="px-4 py-3">Converted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((lead) => (
                <tr
                  key={lead.id}
                  className="cursor-pointer text-neutral-200 hover:bg-white/[0.04]"
                  onClick={() => void openDetail(lead.id)}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-400">
                    {new Date(lead.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{lead.formName}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{lead.fullName ?? "—"}</div>
                    <div className="text-xs text-neutral-500">{lead.email ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <select
                      disabled={Boolean(lead.convertedAt) || busyId === lead.id}
                      className="max-w-[200px] rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                      value={lead.status}
                      onChange={(e) => onStatusSelect(lead, e.target.value as CrmLeadStatus)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-3 text-xs">
                    {lead.meetingLink ? (
                      <a href={lead.meetingLink} target="_blank" rel="noreferrer" className="text-brand-lime hover:underline">
                        Link
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{lead.convertedAt ? "Yes" : "No"}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                    No leads yet. Publish a form and submit from the embed page.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="border-t border-white/10 px-4 py-2 text-xs text-neutral-500">Total: {total}</div>
      </div>

      {detail ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="dialog">
          <div className="h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-[#12181f] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Lead detail</h2>
                <p className="mt-1 text-xs text-neutral-500">{detail.lead.form.name}</p>
              </div>
              <button type="button" className="text-sm text-neutral-400 hover:text-white" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <div>
                <dt className="text-neutral-500">Status</dt>
                <dd className="text-white">{STATUS_LABEL[detail.lead.status]}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Meeting link</dt>
                <dd className="break-all text-brand-lime">
                  {detail.lead.meetingLink ? (
                    <a href={detail.lead.meetingLink} target="_blank" rel="noreferrer">
                      {detail.lead.meetingLink}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Converted</dt>
                <dd className="text-white">
                  {detail.lead.convertedAt ? (
                    <>
                      Yes — user {detail.lead.convertedCustomer?.email ?? detail.lead.convertedCustomerId}
                    </>
                  ) : (
                    "No"
                  )}
                </dd>
              </div>
            </dl>

            <h3 className="mt-8 font-semibold text-white">Submission</h3>
            <div className="mt-2 overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-left text-xs">
                <tbody className="divide-y divide-white/5">
                  {formatPayload(detail.submission.payloadJson).map((row) => (
                    <tr key={row.key}>
                      <td className="whitespace-nowrap bg-black/30 px-3 py-2 font-mono text-neutral-400">{row.key}</td>
                      <td className="px-3 py-2 text-neutral-200">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-xs text-neutral-500">
              <div>Source: {detail.submission.sourceUrl ?? "—"}</div>
              <div>Submitted: {new Date(detail.submission.submittedAt).toLocaleString()}</div>
              {detail.submission.calBookingId ? <div>Cal booking id: {detail.submission.calBookingId}</div> : null}
            </div>

            <h3 className="mt-8 font-semibold text-white">Status history</h3>
            <ul className="mt-2 space-y-2 text-xs text-neutral-300">
              {detail.statusLogs.map((log) => (
                <li key={log.id} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                  <span className="text-neutral-500">{new Date(log.changedAt).toLocaleString()}</span> —{" "}
                  {log.fromStatus ? STATUS_LABEL[log.fromStatus] : "—"} → {STATUS_LABEL[log.toStatus]}
                  {log.changedBy ? ` (${log.changedBy.email})` : ""}
                  {log.meetingLink ? (
                    <div className="mt-1 truncate text-brand-lime">{log.meetingLink}</div>
                  ) : null}
                </li>
              ))}
            </ul>

            {!detail.lead.convertedAt ? (
              <button
                type="button"
                disabled={busyId === detail.lead.id}
                className="mt-8 w-full rounded-lg bg-brand-lime py-3 text-sm font-bold text-canvas hover:brightness-110 disabled:opacity-50"
                onClick={() => void onConvert(detail.lead.id)}
              >
                Convert to customer
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {meetingModalLeadId ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15191C] p-6">
            <h3 className="text-lg font-bold text-white">Meeting link required</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Paste the Cal.com HTTPS meeting URL for this lead.
            </p>
            <input
              className="mt-4 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="https://cal.com/..."
              value={meetingUrlInput}
              onChange={(e) => setMeetingUrlInput(e.target.value)}
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white"
                onClick={() => {
                  setMeetingModalLeadId(null);
                  void load();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-lime px-4 py-2 text-sm font-bold text-canvas"
                onClick={() => void confirmMeetingScheduled()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
