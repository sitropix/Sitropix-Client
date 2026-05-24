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
  const [category, setCategory] = useState("");
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
        category: category.trim() || undefined,
        targetType: targetType.trim() || undefined,
        startAt: startAt || undefined,
        endAt: endAt || undefined,
        limit: 50,
        page,
      });
      setRows(list.rows);
      setTotalPages(list.totalPages);
      if (!action.trim() && !category.trim() && !targetType.trim() && !startAt && !endAt && page === 1) {
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
    const isDefaultView = page === 1 && !action && !category && !targetType && !startAt && !endAt;
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
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((r) => r.action.split(".")[0]?.trim())
            .filter((v): v is string => Boolean(v)),
        ),
      ),
    [rows],
  );
  const targetOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.targetType).filter(Boolean) as string[])).slice(0, 30),
    [rows],
  );
  const filteredRows = useMemo(() => {
    if (!category) return rows;
    return rows.filter((row) => row.action.startsWith(`${category}.`));
  }, [rows, category]);

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Audit Logs" />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-sx-xl font-semibold tracking-tight text-[var(--text-primary)]">Audit Logs</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">Immutable trail of auth, admin, subscription, and billing events.</p>
      </header>

      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
        <div className="grid gap-3 md:grid-cols-7">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="">All categories</option>
            {categoryOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)]"
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
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)]"
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
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <input
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            type="datetime-local"
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <button
            type="button"
            onClick={() => {
              setPage(1);
              void load();
            }}
            className="rounded-lg bg-[var(--color-brand-500)] px-4 py-2 text-sm font-semibold text-white"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={async () => {
              setAction("");
              setCategory("");
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
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 py-2 text-sm text-[var(--text-primary)]"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() =>
              void downloadAdminAuditLogsCsv({
                action: action.trim() || undefined,
                category: category.trim() || undefined,
                targetType: targetType.trim() || undefined,
                startAt: startAt || undefined,
                endAt: endAt || undefined,
              }).catch(() => setNotice("Could not export CSV."))
            }
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 py-2 text-sm text-[var(--text-primary)]"
          >
            Export CSV
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <p className="text-xs uppercase tracking-widest text-[var(--text-tertiary)]">Events (24h)</p>
          <p className="mt-1 text-sx-xl font-semibold text-[var(--text-primary)]">{summary?.last24hTotal ?? 0}</p>
        </article>
        <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <p className="text-xs uppercase tracking-widest text-[var(--text-tertiary)]">Events (7d)</p>
          <p className="mt-1 text-sx-xl font-semibold text-[var(--text-primary)]">{summary?.last7dTotal ?? 0}</p>
        </article>
        <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <p className="text-xs uppercase tracking-widest text-[var(--text-tertiary)]">Failed Logins (24h)</p>
          <p className="mt-1 text-sx-xl font-semibold text-rose-300">{summary?.failedLogins24h ?? 0}</p>
        </article>
        <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <p className="text-xs uppercase tracking-widest text-[var(--text-tertiary)]">Admin Mutations (24h)</p>
          <p className="mt-1 text-sx-xl font-semibold text-[var(--color-brand-600)]">{summary?.adminMutations24h ?? 0}</p>
        </article>
      </section>

      {notice && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{notice}</p>}

      <section className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)]">
        <div className="grid grid-cols-12 border-b border-[var(--border-subtle)] bg-neutral-900/40 px-4 py-3 text-xs uppercase tracking-widest text-[var(--text-tertiary)]">
          <div className="col-span-3">Time</div>
          <div className="col-span-3">Action</div>
          <div className="col-span-2">Actor</div>
          <div className="col-span-2">Target</div>
          <div className="col-span-2">Metadata</div>
        </div>
        {loading && <p className="px-4 py-4 text-sm text-[var(--text-tertiary)]">Loading logs...</p>}
        {!loading &&
          filteredRows.map((row) => (
            <div key={row.id} className="grid grid-cols-12 gap-2 border-b border-[var(--border-subtle)] px-4 py-3 text-xs last:border-b-0 hover:bg-[var(--surface-sunken)]">
              <div className="col-span-3 text-[var(--text-tertiary)]">{fmtTs(row.createdAt)}</div>
              <div className="col-span-3">
                <p className="text-[var(--text-primary)]">{row.action}</p>
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{row.action.split(".")[0] ?? "other"}</p>
              </div>
              <div className="col-span-2 text-[var(--text-secondary)]">{row.actorUserId ?? "system"}</div>
              <div className="col-span-2 text-[var(--text-secondary)]">
                {row.targetType ?? "-"}
                {row.targetId ? `:${row.targetId.slice(0, 8)}` : ""}
              </div>
              <div className="col-span-2 truncate text-[var(--text-tertiary)]">{Object.keys(row.metadata ?? {}).slice(0, 3).join(", ") || "-"}</div>
            </div>
          ))}
        {!loading && filteredRows.length === 0 && <p className="px-4 py-5 text-sm text-[var(--text-tertiary)]">No matching logs found.</p>}
      </section>

      <section className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-tertiary)]">
        <p>
          Page <span className="text-[var(--text-primary)]">{page}</span> of <span className="text-[var(--text-primary)]">{totalPages}</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-1 text-xs text-[var(--text-primary)] disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-1 text-xs text-[var(--text-primary)] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}

