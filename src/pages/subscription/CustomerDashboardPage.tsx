import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { InvoiceTable } from "@/components/subscription/InvoiceTable";
import { SubscriptionStatusBadge } from "@/components/subscription/SubscriptionStatusBadge";
import { useUser } from "@/context/UserContext";

function formatDate(iso?: string) {
  return iso ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso)) : "—";
}

function IconBox({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-lime/25 bg-brand-lime/[0.08] text-brand-lime transition group-hover:border-brand-lime/45 group-hover:bg-brand-lime/[0.12]">
      {children}
    </span>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

const quickLinks: Array<{
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    to: "/subscription-management",
    title: "Subscription Management",
    description: "Plan, payment method and invoices",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M2.25 8.25h19.5M2.25 9.75h19.5M4.5 6.75h15a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0119.5 21.75h-15a2.25 2.25 0 01-2.25-2.25V9A2.25 2.25 0 014.5 6.75z" />
      </svg>
    ),
  },
  {
    to: "/requests",
    title: "Messages",
    description: "Track support conversations",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.33L3 21l2.395-4.365A8.16 8.16 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
  {
    to: "/workspace",
    title: "Files",
    description: "Project docs and downloads",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    to: "/kb",
    title: "Knowledge Base",
    description: "Guides and product docs",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.955 8.955 0 016 18c1.8 0 3.464-.517 4.875-1.407M12 6.042A8.967 8.967 0 0118 3.75c1.052 0 2.062.18 3 .512v14.25a8.955 8.955 0 01-3 .563c-1.8 0-3.464-.517-4.875-1.407M12 6.042v14.25" />
      </svg>
    ),
  },
];

export function CustomerDashboardPage() {
  const { portal, loading, error } = useUser();
  const subscription = portal?.subscription;
  const greeting = portal?.user?.name?.split(" ")[0] ?? "there";
  const invoices = portal?.invoices ?? [];
  const recentInvoices = invoices.slice(0, 5);

  return (
    <div className="space-y-8 opacity-0 animate-fade-up [animation-fill-mode:forwards]">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Dashboard" }]} />

      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-hero-mesh shadow-lift ring-1 ring-white/[0.06]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_35%,rgba(132,204,22,0.14),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 bg-card-shine opacity-40" />
        <div className="relative px-6 py-8 sm:px-10 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-lime">Sitropix Support</p>
          <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Hi {greeting}, how can we help?
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-ink-muted sm:text-[15px]">
            Search guides from the bar above, track requests, and manage your workspace from this hub.
          </p>
        </div>
      </section>

      {loading && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((k) => (
              <Skeleton key={k} className="h-[104px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      )}
      {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

      {!loading && !subscription && (
        <EmptyState
          title="No active subscription yet"
          description="Choose a plan to start your trial and unlock customer features."
          action={{ label: "Choose plan", href: "/subscription" }}
        />
      )}

      {!loading && subscription && (
        <>
          <section className="rounded-2xl border border-white/10 bg-[#0c1016]/90 shadow-glass ring-1 ring-white/[0.04] backdrop-blur-sm">
            <div className="border-b border-white/10 px-6 py-5 sm:px-7 sm:py-6">
              <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">Jump back in</h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
                Self-serve first — we are here when you need a human.
              </p>
            </div>
            <div className="grid gap-3 p-4 sm:p-5 sm:grid-cols-2 xl:grid-cols-4">
              {quickLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 shadow-sm transition hover:border-brand-lime/40 hover:bg-white/[0.05] hover:shadow-md"
                >
                  <IconBox>{item.icon}</IconBox>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">{item.description}</p>
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-brand-lime" />
                </Link>
              ))}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent shadow-glass ring-1 ring-white/[0.05]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-lime/70 to-transparent" />
            <div className="relative p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-7">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                    {subscription.plan?.name ?? "Current plan"}
                  </h2>
                  <SubscriptionStatusBadge status={subscription.status} />
                </div>
                <p className="mt-3 text-sm text-ink-muted">
                  Next billing date{" "}
                  <span className="font-medium text-white">{formatDate(subscription.nextBillingDate)}</span>
                </p>
              </div>
              <div className="mt-5 shrink-0 sm:mt-0">
                <Link
                  to="/subscription-management"
                  className="inline-flex w-full items-center justify-center rounded-full bg-brand-lime px-6 py-2.5 text-sm font-semibold text-canvas shadow-glow transition hover:bg-brand-lime-dim sm:w-auto"
                >
                  Open Subscription Management
                </Link>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-sm font-semibold text-white">Invoices</h2>
              {invoices.length > 5 ? (
                <Link to="/subscription-management" className="text-xs font-semibold text-brand-lime hover:underline">
                  View all in Subscription Management
                </Link>
              ) : null}
            </div>
            {recentInvoices.length > 0 ? (
              <InvoiceTable invoices={recentInvoices} />
            ) : (
              <EmptyState
                title="No invoices yet"
                description="Completed payments will list PDFs and receipt links here and under Subscription Management."
                action={{ label: "Subscription Management", href: "/subscription-management" }}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
