import { Link } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";

export function ProfilePage() {
  const { user } = useAuth();
  const { contact, subscription, loading, error, refresh } = useUser();

  const name =
    contact != null
      ? `${contact.firstName} ${contact.lastName}`.trim()
      : user?.name?.trim() || "—";
  const email = contact?.email ?? user?.email ?? "—";
  const roleLabel = user?.role === "admin" ? "Administrator" : "Customer";

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Profile" }]} />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Profile</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">Your sign-in identity and workspace account details.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:border-brand-lime/35"
        >
          Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      )}

      {loading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-6 w-48" />
            <Skeleton className="mt-2 h-4 w-full" />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-6 w-32" />
          </div>
        </div>
      )}

      {!loading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-6 lg:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-lime">Account</p>
            <h2 className="mt-2 text-xl font-bold text-white">{name}</h2>
            <p className="mt-1 text-sm text-ink-muted">{email}</p>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-subtle">Workspace role</dt>
                <dd className="mt-1 font-medium text-white">{roleLabel}</dd>
              </div>
              {contact?.accountName ? (
                <div>
                  <dt className="text-ink-subtle">Organization</dt>
                  <dd className="mt-1 font-medium text-white">{contact.accountName}</dd>
                </div>
              ) : null}
              {subscription?.planName ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-subtle">Plan</dt>
                  <dd className="mt-1 font-medium text-white">{subscription.planName}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-sm font-semibold text-white">Shortcuts</h3>
            <Link
              to="/subscription-management"
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-white transition hover:border-brand-lime/35"
            >
              Subscription & invoices
            </Link>
            <Link
              to="/workspace"
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-white transition hover:border-brand-lime/35"
            >
              Workspace & documents
            </Link>
            <Link
              to="/requests"
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-white transition hover:border-brand-lime/35"
            >
              Support requests
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}
