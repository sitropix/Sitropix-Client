import { MaterialIcon } from "@/components/MaterialIcon";
import { EmptyState } from "@/components/EmptyState";
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

function formatDate(iso?: string) {
  return iso
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        new Date(iso),
      )
    : "â€”";
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function invoiceStatusLabel(status: string) {
  if (status === "paid" || status === "succeeded") return "Succeeded";
  return status.replace(/_/g, " ");
}

const quickLinks = [
  {
    to: "/subscription-management",
    title: "Subscription",
    description: "Plan, payment method and invoices.",
    icon: "credit_card" as const,
  },
  {
    to: "/requests",
    title: "Messages",
    description: "Track support conversations and chats.",
    icon: "chat_bubble" as const,
  },
  {
    to: "/workspace",
    title: "Files",
    description: "Project docs and resource downloads.",
    icon: "folder" as const,
  },
  {
    to: "/projects",
    title: "My Projects",
    description: "Create and manage your project setups.",
    icon: "account_tree" as const,
  },
  {
    to: "/kb",
    title: "Guides",
    description: "Self-serve guides and product documentation.",
    icon: "menu_book" as const,
  },
] as const;

function DashboardInvoicesTable({ invoices }: { invoices: Invoice[] }) {
  const recent = invoices.slice(0, 3);

  return (
    <div className="overflow-hidden rounded-lg border ink-border-8 bg-surface-container-lowest soft-shadow-xl">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b ink-border-10 bg-surface-container-low">
            <th className="px-6 py-4 text-left font-caption text-caption uppercase tracking-wider text-on-surface-variant">
              Invoice
            </th>
            <th className="px-6 py-4 text-left font-caption text-caption uppercase tracking-wider text-on-surface-variant">
              Date
            </th>
            <th className="px-6 py-4 text-right font-caption text-caption uppercase tracking-wider text-on-surface-variant">
              Amount
            </th>
            <th className="px-6 py-4 text-center font-caption text-caption uppercase tracking-wider text-on-surface-variant">
              Status
            </th>
            <th className="px-6 py-4 text-right font-caption text-caption uppercase tracking-wider text-on-surface-variant">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y ink-border-8">
          {recent.map((invoice) => (
            <tr
              key={invoice.id}
              className="transition-colors hover:bg-surface-container-low/50"
            >
              <td className="px-6 py-4 font-mono font-medium text-on-surface">
                {invoice.invoiceNumber}
              </td>
              <td className="px-6 py-4 font-body-sm text-body-sm text-on-surface-variant">
                {formatDate(invoice.paidAt ?? undefined)}
              </td>
              <td className="px-6 py-4 text-right font-mono text-on-surface">
                {money(invoice.amountCents, invoice.currency)}
              </td>
              <td className="px-6 py-4 text-center">
                <span className="inline-flex items-center rounded-full bg-success-bg px-2.5 py-0.5 font-caption text-caption uppercase text-success">
                  {invoiceStatusLabel(invoice.status)}
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <button
                  type="button"
                  disabled={!invoice.invoicePdfUrl}
                  title={
                    invoice.invoicePdfUrl
                      ? "Download invoice"
                      : "Invoice PDF not available yet"
                  }
                  onClick={() => {
                    if (invoice.invoicePdfUrl) {
                      window.open(
                        invoice.invoicePdfUrl,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }
                  }}
                  className="rounded border ink-border-15 bg-surface-container p-1.5 text-on-surface-variant transition-all hover:text-accent-gold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <MaterialIcon name="download" className="!text-[20px]" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

  const greeting = greetingDisplayName(contact, portal?.user?.name);
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

  const activeProjects = useMemo(
    () => projects.filter((p) => hasValidProjectPlan(p)).length,
    [projects],
  );

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-lg border ink-border-8 bg-surface-container-low p-10 soft-shadow-xl">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent-gold opacity-5 blur-3xl"
          aria-hidden
        />
        <div className="relative z-10 flex max-w-2xl flex-col gap-4">
          <span className="inline-flex w-fit items-center rounded-full bg-gold-light px-3 py-1 font-caption text-caption uppercase tracking-wider text-on-secondary-container">
            Sitropix Support
          </span>
          <h2 className="font-h1 text-h1 text-on-surface">
            Hi {greeting}, how can we help?
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Search guides from the bar above, track requests, and manage your
            workspace from this central hub.
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            <Link
              to="/projects#new-project"
              className="portal-btn-primary inline-flex items-center gap-2 rounded-lg bg-accent-gold px-6 py-3 font-body font-semibold text-white transition-all hover:brightness-110"
            >
              <MaterialIcon name="add" className="!text-[20px]" />
              New Project
            </Link>
            <Link
              to="/subscription-management"
              className="inline-flex items-center rounded-lg border ink-border-15 bg-surface-container-lowest px-6 py-3 font-body font-semibold text-on-surface transition-all hover:bg-surface-container"
            >
              View Invoices
            </Link>
          </div>
        </div>
      </section>

      {loading && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((k) => (
              <Skeleton key={k} className="h-36 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-error/30 bg-error-bg px-4 py-3 font-body-sm text-body-sm text-error">
          {error}
        </p>
      )}

      {!loading && projects.length === 0 && (
        <EmptyState
          title="No projects yet"
          description="Create a project, complete intake, and subscribe from that project's checkout to unlock the full workspace."
          action={{ label: "Create a Project", href: "/projects" }}
        />
      )}

      {!loading && projects.length > 0 && (
        <>
          <section className="space-y-4">
            <div className="px-1">
              <h3 className="font-h2 text-h2 text-on-surface">Jump back in</h3>
              <p className="font-body text-body text-on-surface-variant">
                Self-serve first â€” we are here when you need a human.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {quickLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex flex-col gap-4 rounded-lg border ink-border-8 bg-surface-container-lowest p-6 transition-all hover:ink-border-15 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-low transition-colors group-hover:bg-gold-light">
                    <MaterialIcon
                      name={item.icon}
                      className="!text-[22px] text-on-surface-variant transition-colors group-hover:text-accent-gold"
                    />
                  </div>
                  <div>
                    <h4 className="mb-1 flex items-center justify-between font-body font-semibold text-on-surface">
                      {item.title}
                      <MaterialIcon
                        name="chevron_right"
                        className="!text-[16px] opacity-0 transition-opacity group-hover:opacity-100"
                      />
                    </h4>
                    <p className="line-clamp-2 font-body-sm text-body-sm text-on-surface-variant">
                      {item.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <section className="space-y-4 lg:col-span-5">
              <h3 className="px-1 font-caption text-caption uppercase tracking-widest text-on-surface-variant">
                Plans by Project
              </h3>
              <div className="flex h-full flex-col justify-between rounded-lg border ink-border-8 bg-surface-container-lowest p-6 soft-shadow-xl">
                {primaryProject ? (
                  <>
                    <div className="mb-6 flex items-start justify-between">
                      <div>
                        <h4 className="font-h3 text-h3 font-bold text-on-surface">
                          {primaryProject.name}
                        </h4>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="font-body-sm text-body-sm text-on-surface-variant">
                            {primaryProject.planName ?? "No plan"}
                          </span>
                          {primaryProject.planValidUntil &&
                          hasValidProjectPlan(primaryProject) ? (
                            <>
                              <span className="h-1 w-1 rounded-full bg-outline-variant" />
                              <span className="font-body-sm text-body-sm text-on-surface-variant">
                                Renews {formatDate(primaryProject.planValidUntil)}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 font-caption text-caption uppercase ${
                          hasValidProjectPlan(primaryProject)
                            ? "bg-success-bg text-success"
                            : "bg-warn-bg text-warn"
                        }`}
                      >
                        {hasValidProjectPlan(primaryProject)
                          ? "Active"
                          : "On hold"}
                      </span>
                    </div>
                    {projects.length > 1 ? (
                      <div className="mb-4 max-h-32 space-y-2 overflow-y-auto">
                        {projects.slice(1, 4).map((p) => (
                          <p
                            key={p.id}
                            className="truncate font-body-sm text-body-sm text-on-surface-variant"
                          >
                            {p.name}
                            {p.planName ? ` Â· ${p.planName}` : ""}
                          </p>
                        ))}
                        {projects.length > 4 ? (
                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            +{projects.length - 4} more
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : null}
                <div className="space-y-4">
                  <Link
                    to="/subscription-management"
                    className="block w-full rounded-lg bg-on-surface py-3 text-center font-body font-semibold text-surface transition-colors hover:bg-on-surface/90"
                  >
                    Manage billing
                  </Link>
                </div>
              </div>
            </section>

            <section className="space-y-4 lg:col-span-7">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-caption text-caption uppercase tracking-widest text-on-surface-variant">
                  Recent Invoices
                </h3>
                <Link
                  to="/subscription-management"
                  className="font-body-sm text-body-sm text-accent-gold hover:underline"
                >
                  View all
                </Link>
              </div>
              {invoices.length > 0 ? (
                <DashboardInvoicesTable invoices={invoices} />
              ) : (
                <EmptyState
                  title="No invoices yet"
                  description="Completed payments will appear here."
                  action={{
                    label: "Payments",
                    href: "/subscription-management",
                  }}
                />
              )}
            </section>
          </div>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-lg border ink-border-8 bg-surface-container-lowest p-6">
              <span className="font-caption uppercase tracking-wider text-on-surface-variant">
                Active Projects
              </span>
              <span className="font-h2 font-mono text-h2 text-on-surface">
                {activeProjects}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border ink-border-8 bg-surface-container-lowest p-6">
              <span className="font-caption uppercase tracking-wider text-on-surface-variant">
                Total Projects
              </span>
              <span className="font-h2 font-mono text-h2 text-on-surface">
                {projects.length}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border ink-border-8 bg-surface-container-lowest p-6">
              <span className="font-caption uppercase tracking-wider text-on-surface-variant">
                Open Tickets
              </span>
              <span className="font-h2 font-mono text-h2 text-on-surface">
                {openTickets}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-accent-gold/20 bg-gold-light/50 p-6">
              <span className="font-caption uppercase tracking-wider text-on-secondary-container">
                Recent Invoices
              </span>
              <span className="font-h2 font-mono text-h2 text-on-surface">
                {invoices.length}
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

