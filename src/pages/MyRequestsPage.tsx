import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketRowSkeleton } from "@/components/Skeleton";
import { useTickets } from "@/hooks/useTickets";
import type { TicketStatus } from "@/types/support";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

const filters: { label: string; value: "all" | TicketStatus }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "In progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
];

export function MyRequestsPage() {
  const { tickets, loading, error, reload } = useTickets();
  const [status, setStatus] = useState<"all" | TicketStatus>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const okStatus = status === "all" || t.status === status;
      const okSearch =
        search.trim().length === 0 || t.subject.toLowerCase().includes(search.trim().toLowerCase());
      return okStatus && okSearch;
    });
  }, [tickets, status, search]);

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "My requests" }]} />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">My requests</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            Everything you have opened with our team — filter by lifecycle stage or search by subject.
          </p>
        </div>
        <Link
          to="/ticket"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas shadow-glow transition hover:scale-[1.02] hover:bg-brand-lime-dim"
        >
          New ticket
        </Link>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
          {filters.map((f) => {
            const active = status === f.value;
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatus(f.value)}
                className={[
                  "rounded-full px-4 py-1.5 text-sm font-medium transition",
                  active ? "bg-white text-canvas" : "bg-white/[0.05] text-ink-muted hover:bg-white/10 hover:text-white",
                ].join(" ")}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="w-full sm:max-w-xs">
          <label htmlFor="ticket-search" className="sr-only">
            Search tickets
          </label>
          <input
            id="ticket-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject…"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-lime/35 focus:ring-2 focus:ring-brand-lime/25"
          />
        </div>
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-rose-100">{error}</p>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-rose-300/40 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500/30"
            onClick={() => void reload()}
          >
            Retry loading tickets
          </button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          <TicketRowSkeleton />
          <TicketRowSkeleton />
          <TicketRowSkeleton />
        </div>
      )}

      {!error && !loading && tickets.length === 0 && (
        <EmptyState
          title="No requests yet"
          description="When you reach out, every conversation shows up here with status, owners, and timestamps."
          action={{ label: "Submit a ticket", href: "/ticket" }}
        />
      )}

      {!loading && tickets.length > 0 && filtered.length === 0 && (
        <EmptyState
          title="No requests match"
          description="Try another filter or search term — or open a new ticket and we will pick it up quickly."
          action={{ label: "Clear filters", onClick: () => { setStatus("all"); setSearch(""); } }}
        />
      )}

      {!loading && filtered.length > 0 && (
        <ul className="space-y-3" aria-label="Tickets">
          {filtered.map((t) => (
            <li key={t.id}>
              <Link
                to={`/support/tickets/${t.id}`}
                className="block rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-brand-lime/25 hover:bg-white/[0.04]"
              >
                <article className="group">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-ink-subtle">#{t.id}</span>
                      <StatusBadge status={t.status} />
                      {t.department && (
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-ink-muted">
                          {t.department}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 text-base font-semibold text-white">{t.subject}</h2>
                    <dl className="mt-3 grid gap-3 text-xs text-ink-muted sm:grid-cols-2">
                      <div>
                        <dt className="text-ink-subtle">Created</dt>
                        <dd className="mt-0.5 font-medium text-white/90">{formatDate(t.createdAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-subtle">Last update</dt>
                        <dd className="mt-0.5 font-medium text-white/90">{formatDate(t.updatedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="md:pt-1">
                    <div className="relative border-l border-white/10 pl-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Timeline</p>
                      <ol className="mt-2 space-y-2 text-xs text-ink-muted">
                        <li className="relative">
                          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand-lime" />
                          Opened
                        </li>
                        <li className="relative text-white/80">Latest activity {formatDate(t.updatedAt)}</li>
                      </ol>
                    </div>
                  </div>
                </div>
                </article>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
