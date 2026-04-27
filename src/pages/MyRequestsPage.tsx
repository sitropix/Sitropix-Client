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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
      <path d="M16.5 16.5L21 21" strokeLinecap="round" />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
    <div className="space-y-8 opacity-0 animate-fade-up [animation-fill-mode:forwards]">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "My requests" }]} />

      <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-lime">Support</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">My requests</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
            Everything you have opened with our team — filter by lifecycle stage or search by subject.
          </p>
        </div>
        <Link
          to="/ticket"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas shadow-glow transition hover:bg-brand-lime-dim"
        >
          New ticket
        </Link>
      </header>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1016]/95 shadow-glass ring-1 ring-white/[0.04]">
        <div className="border-b border-white/10 bg-black/25 px-4 py-3 sm:px-5">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">Find requests</h2>
          <p className="mt-0.5 text-xs text-ink-muted">Filter the list or narrow by subject line.</p>
        </div>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1" role="tablist" aria-label="Filter by status">
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
                    "rounded-lg px-3.5 py-2 text-xs font-semibold transition sm:text-sm",
                    active
                      ? "bg-brand-lime text-canvas shadow-glow"
                      : "text-ink-muted hover:bg-white/[0.06] hover:text-white",
                  ].join(" ")}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          <div className="w-full shrink-0 sm:max-w-[280px]">
            <label htmlFor="ticket-search" className="sr-only">
              Search tickets
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 py-1 pl-3 pr-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-brand-lime/40 focus-within:ring-1 focus-within:ring-brand-lime/25">
              <SearchIcon className="h-4 w-4 shrink-0 text-ink-subtle" />
              <input
                id="ticket-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subject…"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-ink-subtle"
              />
            </div>
          </div>
        </div>
      </section>

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
        <div className="space-y-4">
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
        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3 px-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">Your tickets</p>
            <p className="text-xs text-ink-muted">
              {filtered.length} {filtered.length === 1 ? "conversation" : "conversations"}
            </p>
          </div>
          <ul className="space-y-4" aria-label="Tickets">
            {filtered.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/support/tickets/${t.id}`}
                  className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-[#0c1016]/95 shadow-glass ring-1 ring-white/[0.04] transition hover:border-brand-lime/35 hover:ring-brand-lime/15"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <article className="flex flex-col md:flex-row">
                    <div className="min-w-0 flex-1 border-b border-white/10 p-5 md:border-b-0 md:border-r md:p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-ink-subtle">#{t.id}</span>
                        <StatusBadge status={t.status} />
                        {t.department ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                            {t.department}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-2.5 text-base font-semibold leading-snug text-white group-hover:text-brand-lime/95 sm:text-lg">
                        {t.subject}
                      </h2>
                      <dl className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">Created</dt>
                          <dd className="mt-1 font-medium tabular-nums text-white/90">{formatDate(t.createdAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">Last update</dt>
                          <dd className="mt-1 font-medium tabular-nums text-white/90">{formatDate(t.updatedAt)}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="flex shrink-0 flex-col justify-center bg-black/25 px-5 py-5 md:w-[220px] md:border-l md:border-white/10 md:px-6 md:pr-12">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">Timeline</p>
                      <div className="relative mt-3 border-l border-white/15 pl-4">
                        <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#0c1016] bg-brand-lime shadow-[0_0_10px_rgba(132,204,22,0.45)]" />
                        <p className="text-xs font-medium text-white">Opened</p>
                        <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                          Latest activity{" "}
                          <span className="font-medium text-white/85">{formatDate(t.updatedAt)}</span>
                        </p>
                      </div>
                    </div>
                  </article>
                  <ChevronRight className="pointer-events-none absolute right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-brand-lime md:block" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
