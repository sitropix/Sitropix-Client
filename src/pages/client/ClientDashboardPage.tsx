import { Breadcrumb } from "@/components/Breadcrumb";
import { Skeleton } from "@/components/Skeleton";
import { useUser } from "@/context/UserContext";
import type { SubscriptionState } from "@/types/account";

function subscriptionLabel(state: SubscriptionState) {
  switch (state) {
    case "active":
      return "Active";
    case "trialing":
      return "Trial";
    case "past_due":
      return "Past due";
    case "canceled":
      return "Cancelled";
    case "paused":
      return "Paused";
    default:
      return state;
  }
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

export function ClientDashboardPage() {
  const { contact, subscription, loading, error, refresh } = useUser();

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Dashboard" }]} />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Dashboard</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            Customer account and subscription details in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:border-brand-lime/35"
        >
          Refresh
        </button>
      </header>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>}

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-6 w-48" />
            <Skeleton className="mt-2 h-4 w-full" />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-6 w-32" />
            <Skeleton className="mt-2 h-4 w-40" />
          </div>
        </div>
      )}

      {!loading && contact && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-sm font-semibold text-white">Account</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-ink-subtle">Name</dt>
                <dd className="mt-1 font-medium text-white">
                  {contact.firstName} {contact.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-ink-subtle">Email</dt>
                <dd className="mt-1 font-medium text-white">{contact.email}</dd>
              </div>
              {contact.accountName && (
                <div>
                  <dt className="text-ink-subtle">Account</dt>
                  <dd className="mt-1 font-medium text-white">{contact.accountName}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-brand-lime/10 to-transparent p-6">
            <h2 className="text-sm font-semibold text-white">Subscription</h2>
            {subscription ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-ink-subtle">Plan</dt>
                  <dd className="mt-1 font-medium text-white">{subscription.planName}</dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Status</dt>
                  <dd className="mt-1 font-medium text-brand-lime">{subscriptionLabel(subscription.state)}</dd>
                </div>
                <div>
                  <dt className="text-ink-subtle">Renews</dt>
                  <dd className="mt-1 font-medium text-white">{formatDate(subscription.renewsAt)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-ink-muted">No subscription data available.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
