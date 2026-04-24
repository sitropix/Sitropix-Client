import { Link } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { SubscriptionStatusBadge } from "@/components/subscription/SubscriptionStatusBadge";
import { useSubscriptionPortal } from "@/hooks/useSubscriptionPortal";

function formatDate(iso?: string) {
  return iso ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso)) : "—";
}

export function CustomerDashboardPage() {
  const { data, loading, error, refresh } = useSubscriptionPortal();
  const subscription = data?.subscription;
  const greeting = data?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Dashboard" }]} />

      <section className="rounded-2xl border border-white/10 bg-gradient-to-r from-brand-lime/10 via-transparent to-brand-lime/5 p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-lime">Sitropix Support</p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Hi {greeting}, how can we help?</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">
          Search guides, track requests, and manage your workspace from a single customer hub.
        </p>
        <div className="mt-5 flex max-w-2xl gap-2">
          <input
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-ink-subtle focus:border-brand-lime/35 focus:outline-none"
            placeholder="Search billing, API, SSO, onboarding..."
            type="text"
          />
          <button className="rounded-xl bg-brand-lime px-6 py-3 text-sm font-semibold text-canvas">Search</button>
        </div>
      </section>

      {loading && <Skeleton className="h-40 w-full rounded-2xl" />}
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
          <section>
            <h2 className="text-xl font-semibold text-white">Jump back in</h2>
            <p className="mt-1 text-sm text-ink-muted">Self-serve first — we are here when you need a human.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Link to="/subscription-management" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-brand-lime/35">
                <p className="text-sm font-semibold text-white">Subscription Management</p>
                <p className="mt-1 text-xs text-ink-muted">Plan, payment method and invoices</p>
              </Link>
              <Link to="/requests" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-brand-lime/35">
                <p className="text-sm font-semibold text-white">Messages</p>
                <p className="mt-1 text-xs text-ink-muted">Track support conversations</p>
              </Link>
              <Link to="/workspace" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-brand-lime/35">
                <p className="text-sm font-semibold text-white">Files</p>
                <p className="mt-1 text-xs text-ink-muted">Project docs and downloads</p>
              </Link>
              <Link to="/kb" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-brand-lime/35">
                <p className="text-sm font-semibold text-white">Knowledge Base</p>
                <p className="mt-1 text-xs text-ink-muted">Guides and product docs</p>
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{subscription.plan?.name ?? "Current plan"}</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Next billing date: <span className="text-white">{formatDate(subscription.nextBillingDate)}</span>
                </p>
              </div>
              <SubscriptionStatusBadge status={subscription.status} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/subscription-management"
                className="inline-flex items-center justify-center rounded-full bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas shadow-glow transition hover:bg-brand-lime-dim"
              >
                Open Subscription Management
              </Link>
              <button
                type="button"
                onClick={() => void refresh()}
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-brand-lime/35"
              >
                Refresh Data
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
