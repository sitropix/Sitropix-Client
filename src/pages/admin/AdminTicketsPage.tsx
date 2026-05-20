import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { StatusBadge } from "@/components/StatusBadge";
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

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

const categoryTabs: { label: string; value: AdminTicketCategoryScope; description: string }[] = [
  {
    label: "General",
    value: "general",
    description: "Account, billing, and other requests without a project or add-on",
  },
  {
    label: "Non-general",
    value: "non_general",
    description: "Edit and add-on requests tied to a project",
  },
];

const filters: { label: string; value: "all" | TicketStatus }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "In progress", value: "in_progress" },
  { label: "Hold", value: "hold" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const priorityFilters: { label: string; value: "all" | TicketPriority }[] = [
  { label: "All priorities", value: "all" },
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

export function AdminTicketsPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const [categoryTab, setCategoryTab] = useState<AdminTicketCategoryScope>("general");
  const [status, setStatus] = useState<"all" | TicketStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TicketPriority>("all");
  const [rows, setRows] = useState<AdminSupportTicketListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noModuleAccess, setNoModuleAccess] = useState(false);

  const canUsePrefetch =
    categoryTab === "general" && status === "all" && priorityFilter === "all" && Boolean(cache.tickets?.length);

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
          if (categoryTab === "general" && status === "all" && priorityFilter === "all") {
            updateCache({ tickets: r.items });
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (isModuleForbiddenError(err)) setNoModuleAccess(true);
          else setError("Unable to load tickets.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    if (canUsePrefetch && cache.tickets) {
      const generalOnly = cache.tickets.filter((t) => (t.category ?? "general") === "general");
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

  const activeCategoryMeta = categoryTabs.find((t) => t.value === categoryTab);

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Admin" }, { label: "Support tickets" }]} />
      <header>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Support tickets</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {total} in {activeCategoryMeta?.label ?? "this tab"} — filter by status and priority, then open a thread to
          reply.
        </p>
      </header>

      <div
        className="inline-flex rounded-full border border-white/10 bg-black/30 p-1"
        role="tablist"
        aria-label="Ticket category"
      >
        {categoryTabs.map((tab) => {
          const active = categoryTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCategoryTab(tab.value)}
              className={[
                "rounded-full px-5 py-2 text-sm font-semibold transition",
                active ? "bg-brand-lime text-canvas shadow-glow" : "text-ink-muted hover:text-white",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeCategoryMeta && (
        <p className="text-xs text-ink-muted">{activeCategoryMeta.description}</p>
      )}

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

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by priority">
        {priorityFilters.map((f) => {
          const active = priorityFilter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPriorityFilter(f.value)}
              className={[
                "rounded-full px-4 py-1.5 text-sm font-medium transition",
                active ? "bg-brand-lime/20 text-brand-lime" : "bg-white/[0.05] text-ink-muted hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      )}

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      )}

      {!loading && rows.length === 0 && (
        <p className="text-sm text-ink-muted">No tickets in this view.</p>
      )}

      {!loading && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((t) => (
            <li key={t.id}>
              <Link
                to={`/admin/tickets/${t.id}`}
                className="block rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-brand-lime/25 hover:bg-white/[0.04]"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-ink-subtle">#{t.id}</span>
                      <StatusBadge status={t.status} />
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                        {categoryLabel(t.category)}
                      </span>
                      {t.priority ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                          {t.priority}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-2 text-base font-semibold text-white">{t.subject}</h2>
                    <TicketLinkedMeta editType={t.editType} addon={t.addon} className="mt-2" />
                    <p className="mt-1 text-xs text-ink-muted">
                      {t.user.name} &lt;{t.user.email}&gt; — {t.threadCount} message{t.threadCount === 1 ? "" : "s"}
                      {t.projectName ? ` — ${t.projectName}` : null}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-ink-subtle">Updated {formatDate(t.updatedAt)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
