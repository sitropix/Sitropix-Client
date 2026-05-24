import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { TicketLinkedMeta } from "@/components/support/TicketLinkedMeta";
import { Skeleton } from "@/components/Skeleton";
import { isModuleForbiddenError } from "@/services/http";
import { fetchAdminTickets } from "@/services/supportApi";
import type {
  AdminSupportTicketListItem,
  AdminTicketCategoryScope,
  SupportTicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/types/support";
import { SxBadge } from "@/components/sx/Badge";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxSegmentedControl } from "@/components/sx/SegmentedControl";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

const categoryTabs: {
  label: string;
  value: AdminTicketCategoryScope;
}[] = [
  { label: "General", value: "general" },
  { label: "Edit & add-on", value: "non_general" },
];

const filters: { label: string; value: "all" | TicketStatus }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "In progress", value: "in_progress" },
  { label: "On hold", value: "hold" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const priorityFilters: { label: string; value: "all" | TicketPriority }[] = [
  { label: "All", value: "all" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

function categoryLabel(category: SupportTicketCategory | undefined): string {
  if (category === "edit") return "Edit";
  if (category === "addon") return "Add-on";
  return "General";
}

function statusBadge(status: TicketStatus) {
  if (status === "open") return <SxBadge variant="open">Open</SxBadge>;
  if (status === "in_progress")
    return <SxBadge variant="progress">In progress</SxBadge>;
  if (status === "hold") return <SxBadge variant="warning">On hold</SxBadge>;
  if (status === "resolved")
    return <SxBadge variant="resolved">Resolved</SxBadge>;
  if (status === "closed") return <SxBadge variant="closed">Closed</SxBadge>;
  return <SxBadge>{status}</SxBadge>;
}

export function AdminTicketsPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const [categoryTab, setCategoryTab] =
    useState<AdminTicketCategoryScope>("general");
  const [status, setStatus] = useState<"all" | TicketStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<
    "all" | TicketPriority
  >("all");
  const [rows, setRows] = useState<AdminSupportTicketListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noModuleAccess, setNoModuleAccess] = useState(false);

  const canUsePrefetch =
    categoryTab === "general" &&
    status === "all" &&
    priorityFilter === "all" &&
    Boolean(cache.tickets?.length);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(!canUsePrefetch);
      setNoModuleAccess(false);
      setError(null);
      try {
        const r = await fetchAdminTickets({
          categoryScope: categoryTab,
          status: status === "all" ? undefined : status,
          priority: priorityFilter === "all" ? undefined : priorityFilter,
          limit: 100,
        });
        if (!cancelled) {
          setRows(r.items);
          setTotal(r.total);
          if (
            categoryTab === "general" &&
            status === "all" &&
            priorityFilter === "all"
          ) {
            updateCache({ tickets: r.items });
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (isModuleForbiddenError(err)) setNoModuleAccess(true);
          else setError("Couldn't load tickets.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    if (canUsePrefetch && cache.tickets) {
      const generalOnly = cache.tickets.filter(
        (t) => (t.category ?? "general") === "general",
      );
      setRows(generalOnly);
      setTotal(generalOnly.length);
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [categoryTab, status, priorityFilter]);

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Support Tickets" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-[var(--border-subtle)] pb-4">
        <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Support
        </p>
        <h1 className="mt-1.5 font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          Tickets
        </h1>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">
          {total} in this view. Filter, then open a thread to reply.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <SxSegmentedControl<AdminTicketCategoryScope>
          ariaLabel="Ticket category"
          options={categoryTabs}
          value={categoryTab}
          onChange={setCategoryTab}
        />
        <div className="flex flex-wrap gap-2">
          <SxSegmentedControl<"all" | TicketStatus>
            ariaLabel="Status"
            size="sm"
            options={filters}
            value={status}
            onChange={setStatus}
          />
          <SxSegmentedControl<"all" | TicketPriority>
            ariaLabel="Priority"
            size="sm"
            options={priorityFilters}
            value={priorityFilter}
            onChange={setPriorityFilter}
          />
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-sx-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-sx-sm text-[var(--color-danger-fg)]"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-sx-md" />
          <Skeleton className="h-16 w-full rounded-sx-md" />
          <Skeleton className="h-16 w-full rounded-sx-md" />
        </div>
      ) : rows.length === 0 ? (
        <SxEmptyState
          title="No tickets in this view."
          description="Switch tabs or clear filters to see more."
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((t) => (
            <li key={t.id}>
              <Link
                to={`/admin/tickets/${t.id}`}
                className="grid grid-cols-[80px_1fr_auto] items-center gap-3 rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 transition-colors duration-[150ms] hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)] sm:grid-cols-[100px_1fr_auto_auto]"
              >
                <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
                  #{t.id.slice(-6).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-ui text-sx-sm font-medium text-[var(--text-primary)]">
                    {t.subject}
                  </p>
                  <TicketLinkedMeta
                    editType={t.editType}
                    addon={t.addon}
                    className="mt-1"
                  />
                  <p className="mt-1 truncate text-sx-2xs text-[var(--text-tertiary)]">
                    {t.user.name} · {t.threadCount} msg
                    {t.threadCount === 1 ? "" : "s"}
                    {t.projectName ? ` · ${t.projectName}` : ""}
                  </p>
                </div>
                <div className="hidden sm:flex sm:items-center sm:gap-1.5">
                  <SxBadge variant="neutral" withDot={false}>
                    {categoryLabel(t.category)}
                  </SxBadge>
                  {t.priority === "urgent" ? (
                    <SxBadge variant="urgent">Urgent</SxBadge>
                  ) : null}
                  {statusBadge(t.status)}
                </div>
                <span className="font-mono text-sx-2xs text-[var(--text-tertiary)]">
                  {formatDate(t.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
