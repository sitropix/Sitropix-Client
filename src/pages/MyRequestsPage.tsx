import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TicketLinkedMetaLight } from "@/components/support/TicketLinkedMetaLight";
import { TicketRowSkeleton } from "@/components/Skeleton";
import { useTickets } from "@/hooks/useTickets";
import type { TicketStatus } from "@/types/support";
import { SxButton } from "@/components/sx/Button";
import { SxBadge } from "@/components/sx/Badge";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxInput } from "@/components/sx/Input";
import { SxPageHeader } from "@/components/sx/PageHeader";
import { SxSegmentedControl } from "@/components/sx/SegmentedControl";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function relative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.round(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(iso);
}

const STATUS_FILTERS = [
  { value: "all" as const, label: "All" },
  { value: "open" as const, label: "Open" },
  { value: "in_progress" as const, label: "In progress" },
  { value: "hold" as const, label: "On hold" },
  { value: "resolved" as const, label: "Resolved" },
  { value: "closed" as const, label: "Closed" },
];

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

function ticketBadgeVariant(status: TicketStatus) {
  switch (status) {
    case "open":
      return "open" as const;
    case "in_progress":
      return "progress" as const;
    case "hold":
      return "warning" as const;
    case "resolved":
      return "resolved" as const;
    case "closed":
      return "closed" as const;
    default:
      return "neutral" as const;
  }
}

function ticketBadgeLabel(status: TicketStatus) {
  if (status === "in_progress") return "In progress";
  if (status === "hold") return "On hold";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function MyRequestsPage() {
  const { tickets, loading, error, reload } = useTickets();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [reloadBusy, setReloadBusy] = useState(false);

  useEffect(() => {
    document.title = "Tickets · Sitropix";
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tickets.length };
    for (const t of tickets) counts[t.status] = (counts[t.status] ?? 0) + 1;
    return counts;
  }, [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const okStatus = status === "all" || t.status === status;
      const okSearch =
        search.trim().length === 0 ||
        t.subject.toLowerCase().includes(search.trim().toLowerCase());
      return okStatus && okSearch;
    });
  }, [tickets, status, search]);

  return (
    <div data-sx-root className="flex flex-col gap-6">
      <SxPageHeader
        title="Tickets"
        description="Everything you've opened with our team — filter by status or search by subject."
        actions={
          <Link to="/tickets/new">
            <SxButton variant="primary">+ New ticket</SxButton>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SxSegmentedControl<StatusFilter>
          ariaLabel="Filter by status"
          options={STATUS_FILTERS.map((f) => ({
            value: f.value,
            label: f.label,
            count: statusCounts[f.value] ?? 0,
          }))}
          value={status}
          onChange={setStatus}
        />
        <div className="w-full sm:w-[280px]">
          <SxInput
            label="Search"
            hideLabel
            placeholder="Search subject…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-sx-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-bg)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sx-sm text-[var(--color-danger-fg)]">{error}</p>
          <SxButton
            variant="secondary"
            size="sm"
            loading={reloadBusy}
            onClick={() => {
              if (reloadBusy) return;
              setReloadBusy(true);
              void reload().finally(() => setReloadBusy(false));
            }}
          >
            {reloadBusy ? "Retrying…" : "Try again"}
          </SxButton>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <TicketRowSkeleton />
          <TicketRowSkeleton />
          <TicketRowSkeleton />
        </div>
      ) : null}

      {!error && !loading && tickets.length === 0 ? (
        <SxEmptyState
          title="No tickets yet."
          description="When you need a change to your site — new copy, a fresh photo, anything — open a ticket and we'll take it from there."
          action={
            <Link to="/tickets/new">
              <SxButton variant="primary">Open your first ticket</SxButton>
            </Link>
          }
        />
      ) : null}

      {!loading && tickets.length > 0 && filtered.length === 0 ? (
        <SxEmptyState
          title="Nothing matches."
          description="Try another filter or search term."
          action={
            <SxButton
              variant="secondary"
              onClick={() => {
                setStatus("all");
                setSearch("");
              }}
            >
              Clear filters
            </SxButton>
          }
        />
      ) : null}

      {!loading && filtered.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="Tickets">
          {filtered.map((t) => (
            <li key={t.id}>
              <Link
                to={`/tickets/${t.id}`}
                className="group grid grid-cols-[80px_1fr_auto_auto] items-center gap-4 rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 transition-colors duration-[150ms] hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]"
              >
                <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
                  #{t.id.slice(-6).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-ui text-sx-sm font-medium text-[var(--text-primary)]">
                    {t.subject}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sx-xs text-[var(--text-tertiary)]">
                    <span>Opened {relative(t.createdAt)}</span>
                    {t.projectName ? (
                      <span className="text-[var(--text-secondary)]">
                        · {t.projectName}
                      </span>
                    ) : null}
                    <TicketLinkedMetaLight
                      editType={t.editType}
                      addon={t.addon}
                    />
                  </div>
                </div>
                {t.priority === "urgent" ? (
                  <SxBadge variant="urgent">Urgent</SxBadge>
                ) : (
                  <SxBadge variant={ticketBadgeVariant(t.status)}>
                    {ticketBadgeLabel(t.status)}
                  </SxBadge>
                )}
                <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
                  {relative(t.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
