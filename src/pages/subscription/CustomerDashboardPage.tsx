import { MaterialIcon } from "@/components/MaterialIcon";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { useTickets } from "@/hooks/useTickets";
import {
  hasValidProjectPlan,
  listProjectsByUser,
} from "@/services/projectsStore";
import type { AccountProfile } from "@/types/account";
import type { Invoice } from "@/types/subscription";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SxButton } from "@/components/sx/Button";
import { SxBadge } from "@/components/sx/Badge";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxMetricCard } from "@/components/sx/MetricCard";
import { SxPageHeader } from "@/components/sx/PageHeader";
import { SxPanel } from "@/components/sx/Panel";
import { America250Pill } from "@/components/america250";

function capitalizeSegment(value: string): string {
  const t = value.trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function greetingDisplayName(
  contact: AccountProfile | null,
  fallbackFullName?: string,
): string {
  if (contact) {
    const first = capitalizeSegment(contact.firstName ?? "");
    const last = capitalizeSegment(contact.lastName ?? "");
    if (first && last) return `${first} ${last}`;
    if (first) return first;
    if (last) return last;
  }
  const raw = fallbackFullName?.trim();
  if (raw) {
    const segments = raw.split(/\s+/).map(capitalizeSegment).filter(Boolean);
    if (segments.length === 1) return segments[0]!;
    if (segments.length > 1)
      return `${segments[0]} ${segments.slice(1).join(" ")}`;
  }
  return "there";
}

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(iso?: string) {
  return iso
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        new Date(iso),
      )
    : "—";
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function invoiceStatusVariant(
  status: string,
): "success" | "info" | "warning" | "danger" {
  if (status === "paid" || status === "succeeded") return "success";
  if (status === "open" || status === "pending") return "info";
  if (status === "uncollectible" || status === "void") return "danger";
  return "warning";
}

function invoiceStatusLabel(status: string) {
  if (status === "paid" || status === "succeeded") return "Paid";
  return status.replace(/_/g, " ");
}

const QUICK_LINKS = [
  {
    to: "/tickets/new",
    title: "New ticket",
    description: "Need a change? Tell us what to update.",
    icon: "chat_bubble" as const,
  },
  {
    to: "/projects",
    title: "My projects",
    description: "Open your project dashboards.",
    icon: "account_tree" as const,
  },
  {
    to: "/files",
    title: "Files",
    description: "Brand assets and project documents.",
    icon: "folder" as const,
  },
  {
    to: "/help",
    title: "Help center",
    description: "Self-serve guides and answers.",
    icon: "menu_book" as const,
  },
] as const;

function RecentInvoicesPanel({ invoices }: { invoices: Invoice[] }) {
  const recent = invoices.slice(0, 4);
  if (recent.length === 0) {
    return (
      <SxEmptyState
        title="No invoices yet"
        description="Completed payments will appear here."
        action={
          <Link to="/billing">
            <SxButton variant="secondary">Open billing</SxButton>
          </Link>
        }
      />
    );
  }
  return (
    <SxPanel
      title="Recent invoices"
      action={
        <Link
          to="/billing"
          className="text-sx-xs font-semibold text-[var(--text-brand)] hover:underline"
        >
          View all →
        </Link>
      }
      padded={false}
    >
      <ul className="divide-y divide-[var(--border-subtle)]">
        {recent.map((invoice) => (
          <li
            key={invoice.id}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3"
          >
            <div className="min-w-0">
              <div className="font-mono text-sx-xs text-[var(--text-tertiary)]">
                {invoice.invoiceNumber}
              </div>
              <div className="text-sx-sm text-[var(--text-primary)]">
                {formatDate(invoice.paidAt ?? undefined)}
              </div>
            </div>
            <div className="font-mono text-sx-sm text-[var(--text-primary)]">
              {money(invoice.amountCents, invoice.currency)}
            </div>
            <div className="flex items-center gap-2">
              <SxBadge variant={invoiceStatusVariant(invoice.status)}>
                {invoiceStatusLabel(invoice.status)}
              </SxBadge>
              {invoice.invoicePdfUrl ? (
                <a
                  href={invoice.invoicePdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Download invoice"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sx-sm border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
                >
                  <MaterialIcon name="download" className="!text-[16px]" />
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </SxPanel>
  );
}

export function CustomerDashboardPage() {
  const { user } = useAuth();
  const { portal, loading, error, contact } = useUser();
  const { tickets } = useTickets();
  const [projects, setProjects] = useState<
    Awaited<ReturnType<typeof listProjectsByUser>>
  >([]);
  const resolvedUserId = user?.id ?? portal?.user?.id ?? "guest-user";

  useEffect(() => {
    document.title = "Home · Sitropix";
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listProjectsByUser(resolvedUserId)
      .then((rows) => {
        if (!cancelled) setProjects(rows);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedUserId]);

  const name = greetingDisplayName(contact, portal?.user?.name);
  const invoices = portal?.invoices ?? [];

  const primaryProject = useMemo(() => {
    const subscribed = projects.filter((p) => hasValidProjectPlan(p));
    return subscribed[0] ?? projects[0] ?? null;
  }, [projects]);

  const openTickets = useMemo(
    () =>
      tickets.filter((t) => t.status === "open" || t.status === "in_progress")
        .length,
    [tickets],
  );

  const urgentTickets = useMemo(
    () => tickets.filter((t) => t.priority === "urgent" && t.status !== "closed").length,
    [tickets],
  );

  const activeProjects = useMemo(
    () => projects.filter((p) => hasValidProjectPlan(p)).length,
    [projects],
  );

  const upcomingRenewal = primaryProject?.planValidUntil
    ? formatDate(primaryProject.planValidUntil)
    : null;

  return (
    <div data-sx-root className="flex flex-col gap-7">
      <America250Pill />

      <SxPageHeader
        title={`${timeOfDayGreeting()}, ${name}.`}
        description={
          primaryProject?.planName
            ? `${primaryProject.name} · ${primaryProject.planName}${
                upcomingRenewal ? ` · Renews ${upcomingRenewal}` : ""
              }`
            : "Manage your projects, tickets and billing — all in one place."
        }
        actions={
          <Link to="/tickets/new">
            <SxButton variant="primary">+ New ticket</SxButton>
          </Link>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-sx-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-sx-sm text-[var(--color-danger-fg)]"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((k) => (
              <Skeleton key={k} className="h-28 rounded-sx-lg" />
            ))}
          </div>
          <Skeleton className="h-48 w-full rounded-sx-lg" />
        </div>
      ) : (
        <>
          <section
            aria-label="Account metrics"
            className="grid gap-4 md:grid-cols-3"
          >
            <SxMetricCard
              label="Active projects"
              value={
                <>
                  {activeProjects}
                  <small className="ml-1 font-ui text-sx-sm font-normal text-[var(--text-tertiary)]">
                    of {projects.length}
                  </small>
                </>
              }
              meta={
                projects.length === 0 ? (
                  <span>No projects yet</span>
                ) : activeProjects === 0 ? (
                  <SxBadge variant="warning">Awaiting plan</SxBadge>
                ) : (
                  <span>Subscriptions in good standing</span>
                )
              }
            />
            <SxMetricCard
              label="Open tickets"
              value={openTickets}
              meta={
                openTickets === 0 ? (
                  <span>All caught up.</span>
                ) : (
                  <span className="flex items-center gap-2">
                    {urgentTickets > 0 ? (
                      <SxBadge variant="urgent">{urgentTickets} urgent</SxBadge>
                    ) : (
                      <SxBadge variant="progress">In progress</SxBadge>
                    )}
                  </span>
                )
              }
            />
            <SxMetricCard
              label="Next invoice"
              value={
                invoices[0]
                  ? money(invoices[0].amountCents, invoices[0].currency)
                  : "—"
              }
              meta={
                upcomingRenewal ? (
                  <span>Renews {upcomingRenewal}</span>
                ) : invoices[0] ? (
                  <span>{formatDate(invoices[0].paidAt ?? undefined)}</span>
                ) : (
                  <span>No invoices yet</span>
                )
              }
            />
          </section>

          {projects.length === 0 ? (
            <SxEmptyState
              title="No projects yet."
              description="Create your first project to get a site online — it takes about three minutes."
              action={
                <Link to="/projects">
                  <SxButton variant="primary">Create your first project</SxButton>
                </Link>
              }
            />
          ) : null}

          <section aria-label="Quick links" className="grid gap-4 md:grid-cols-4">
            {QUICK_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex flex-col gap-3 rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 transition-all duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-sx-md"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-sx-md bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
                  <MaterialIcon name={item.icon} className="!text-[20px]" />
                </div>
                <div>
                  <div className="font-ui text-sx-sm font-semibold text-[var(--text-primary)]">
                    {item.title}
                  </div>
                  <p className="mt-1 text-sx-xs leading-relaxed text-[var(--text-secondary)]">
                    {item.description}
                  </p>
                </div>
              </Link>
            ))}
          </section>

          <RecentInvoicesPanel invoices={invoices} />
        </>
      )}
    </div>
  );
}
