import { useEffect, useMemo, useState } from "react";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { isModuleForbiddenError } from "@/services/http";
import { downloadAdminAuditLogsCsv, fetchAdminAuditLogs, fetchAdminAuditSummary } from "@/services/subscriptionsApi";
import type { AuditLogRow, AuditLogSummary } from "@/types/subscription";

function fmtTs(value: string) {
  return new Date(value).toLocaleString();
}

export function AdminAuditLogsPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<AuditLogSummary | null>(null);
  const [noModuleAccess, setNoModuleAccess] = useState(false);

  async function load() {
    setLoading(rows.length === 0);
    setNoModuleAccess(false);
    setNotice(null);
    let listLoaded = false;
    try {
      const list = await fetchAdminAuditLogs({
        action: action.trim() || undefined,
        targetType: targetType.trim() || undefined,
        startAt: startAt || undefined,
        endAt: endAt || undefined,
        limit: 50,
        page,
      });
      setRows(list.rows);
      setTotalPages(list.totalPages);
      if (!action.trim() && !targetType.trim() && !startAt && !endAt && page === 1) {
        updateCache({ auditLogs: list });
      }
      listLoaded = true;
    } catch (err) {
      if (isModuleForbiddenError(err)) {
        setNoModuleAccess(true);
        return;
      }
      setNotice("Could not load audit logs.");
    }
    try {
      const metrics = await fetchAdminAuditSummary();
      setSummary(metrics);
      updateCache({ auditSummary: metrics });
    } catch (err) {
      if (isModuleForbiddenError(err)) {
        setNoModuleAccess(true);
        return;
      }
      if (listLoaded) setNotice("Audit summary is temporarily unavailable.");
      else setNotice("Could not load audit logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const isDefaultView = page === 1 && !action && !targetType && !startAt && !endAt;
    if (cache.auditLogs && isDefaultView) {
      setRows(cache.auditLogs.rows);
      setTotalPages(cache.auditLogs.totalPages);
      setLoading(false);
    }
    if (cache.auditSummary) setSummary(cache.auditSummary);
    if (isDefaultView && cache.auditLogs && cache.auditSummary) return;
    void load();
  }, [page]);

  const actionOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))).slice(0, 60), [rows]);
  const targetOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.targetType).filter(Boolean) as string[])).slice(0, 30),
    [rows],
  );

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Audit Logs" />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-white">Audit Logs</h1>
        <p className="mt-1 text-sm text-neutral-500">Immutable trail of auth, admin, subscription, and billing events.</p>
      </header>

      <section className="rounded-xl border border-[#24292E] bg-[#15191C] p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white"
          >
            <option value="">All actions</option>
            {actionOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white"
          >
            <option value="">All targets</option>
            {targetOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <input
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            type="datetime-local"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white"
          />
          <input
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            type="datetime-local"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={() => {
              setPage(1);
              void load();
            }}
            className="rounded-lg bg-brand-lime px-4 py-2 text-sm font-semibold text-canvas"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={async () => {
              setAction("");
              setTargetType("");
              setStartAt("");
              setEndAt("");
              setPage(1);
              setLoading(true);
              setNotice(null);
              try {
                const [list, metrics] = await Promise.all([
                  fetchAdminAuditLogs({ limit: 50, page: 1 }),
                  fetchAdminAuditSummary(),
                ]);
                setRows(list.rows);
                setTotalPages(list.totalPages);
                setSummary(metrics);
              } catch (err) {
                if (isModuleForbiddenError(err)) {
                  setNoModuleAccess(true);
                } else {
                  setNotice("Could not load audit logs.");
                }
              } finally {
                setLoading(false);
              }
            }}
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-4 py-2 text-sm text-white"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() =>
              void downloadAdminAuditLogsCsv({
                action: action.trim() || undefined,
                targetType: targetType.trim() || undefined,
                startAt: startAt || undefined,
                endAt: endAt || undefined,
              }).catch(() => setNotice("Could not export CSV."))
            }
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-4 py-2 text-sm text-white"
          >
            Export CSV
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <article className="rounded-xl border border-[#24292E] bg-[#15191C] p-4">
          <p className="text-xs uppercase tracking-widest text-neutral-500">Events (24h)</p>
          <p className="mt-1 text-2xl font-bold text-white">{summary?.last24hTotal ?? 0}</p>
        </article>
        <article className="rounded-xl border border-[#24292E] bg-[#15191C] p-4">
          <p className="text-xs uppercase tracking-widest text-neutral-500">Events (7d)</p>
          <p className="mt-1 text-2xl font-bold text-white">{summary?.last7dTotal ?? 0}</p>
        </article>
        <article className="rounded-xl border border-[#24292E] bg-[#15191C] p-4">
          <p className="text-xs uppercase tracking-widest text-neutral-500">Failed Logins (24h)</p>
          <p className="mt-1 text-2xl font-bold text-rose-300">{summary?.failedLogins24h ?? 0}</p>
        </article>
        <article className="rounded-xl border border-[#24292E] bg-[#15191C] p-4">
          <p className="text-xs uppercase tracking-widest text-neutral-500">Admin Mutations (24h)</p>
          <p className="mt-1 text-2xl font-bold text-brand-lime">{summary?.adminMutations24h ?? 0}</p>
        </article>
      </section>

      {notice && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{notice}</p>}

      <section className="overflow-hidden rounded-xl border border-[#24292E] bg-[#15191C]">
        <div className="grid grid-cols-12 border-b border-[#24292E] bg-neutral-900/40 px-4 py-3 text-xs uppercase tracking-widest text-neutral-500">
          <div className="col-span-3">Time</div>
          <div className="col-span-3">Action</div>
          <div className="col-span-2">Actor</div>
          <div className="col-span-2">Target</div>
          <div className="col-span-2">Metadata</div>
        </div>
        {loading && <p className="px-4 py-4 text-sm text-neutral-400">Loading logs...</p>}
        {!loading &&
          rows.map((row) => (
            <div key={row.id} className="grid grid-cols-12 gap-2 border-b border-[#24292E] px-4 py-3 text-xs last:border-b-0 hover:bg-[#1C2126]">
              <div className="col-span-3 text-neutral-400">{fmtTs(row.createdAt)}</div>
              <div className="col-span-3 text-white">{row.action}</div>
              <div className="col-span-2 text-neutral-300">{row.actorUserId ?? "system"}</div>
              <div className="col-span-2 text-neutral-300">
                {row.targetType ?? "-"}
                {row.targetId ? `:${row.targetId.slice(0, 8)}` : ""}
              </div>
              <div className="col-span-2 truncate text-neutral-400">{Object.keys(row.metadata ?? {}).slice(0, 3).join(", ") || "-"}</div>
            </div>
          ))}
        {!loading && rows.length === 0 && <p className="px-4 py-5 text-sm text-neutral-400">No matching logs found.</p>}
      </section>

      <section className="flex items-center justify-between rounded-xl border border-[#24292E] bg-[#15191C] px-4 py-3 text-sm text-neutral-400">
        <p>
          Page <span className="text-white">{page}</span> of <span className="text-white">{totalPages}</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-1 text-xs text-white disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded border border-[#24292E] bg-[#1C2126] px-3 py-1 text-xs text-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}

