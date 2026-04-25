import { useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { InvoiceTable } from "@/components/subscription/InvoiceTable";
import { useSubscriptionPortal } from "@/hooks/useSubscriptionPortal";
import { createBillingPortalSession } from "@/services/subscriptionsApi";
import { useUser } from "@/context/UserContext";
import type { SubscriptionState } from "@/types/account";
import { Link } from "react-router-dom";

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

export function SubscriptionManagementPage() {
  const { contact, subscription, loading: userLoading, error: userError } = useUser();
  const { data, loading: billingLoading, error: billingError } = useSubscriptionPortal();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingCount = subscription?.state === "past_due" ? 1 : 0;

  async function openBillingPortal() {
    setBusy(true);
    setNotice(null);
    try {
      const { url } = await createBillingPortalSession(`${window.location.origin}/subscription-management`);
      if (url) window.location.assign(url);
    } catch {
      setNotice(
        "Billing portal needs a Stripe customer. Complete Checkout on the subscription page first, or use a dev trial.",
      );
    } finally {
      setBusy(false);
    }
  }


  const defaultMethod = data?.paymentMethods.find((pm) => pm.isDefault);
  const status = subscription?.state ?? "trialing";
  const statusTone =
    status === "active"
      ? "bg-brand-lime/15 text-brand-lime border-brand-lime/30"
      : status === "past_due"
        ? "bg-amber-500/10 text-amber-300 border-amber-400/30"
        : "bg-white/10 text-white border-white/20";

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Subscription Management" }]} />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Subscription Management</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Account, plan status, payment method, and invoices in one place.
          </p>
        </div>
      </header>

      {userError && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{userError}</p>}
      {billingError && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{billingError}</p>}
      {notice && <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-ink-muted">{notice}</p>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="rounded-2xl border border-white/10 bg-[#15191c] xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-brand-lime/20 text-2xl text-brand-lime">◆</div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-white">{subscription?.planName ?? "No active plan"}</h2>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone}`}>
                    {subscriptionLabel(status)}
                  </span>
                </div>
                <p className="text-sm text-ink-muted">Manage renewals, payments, and subscription lifecycle.</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-ink-subtle">Next billing</p>
              <p className="text-base font-semibold text-white">{formatDate(subscription?.renewsAt)}</p>
            </div>
          </div>
          <div className="p-6">
            {userLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-ink-subtle">Account</p>
                  {contact ? (
                    <dl className="mt-3 space-y-2 text-sm">
                      <div>
                        <dt className="text-ink-subtle">Name</dt>
                        <dd className="text-white">
                          {contact.firstName} {contact.lastName}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-subtle">Email</dt>
                        <dd className="text-white">{contact.email}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-2 text-sm text-ink-muted">No account data available.</p>
                  )}
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-ink-subtle">Plan actions</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to="/subscription"
                      className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:border-brand-lime/35"
                    >
                      Change plan
                    </Link>
                    <button
                      type="button"
                      onClick={() => void openBillingPortal()}
                      disabled={busy}
                      className="rounded-lg bg-brand-lime px-3 py-2 text-xs font-semibold text-canvas transition hover:bg-brand-lime-dim disabled:opacity-50"
                    >
                      {busy ? "Opening..." : "Manage billing"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#15191c] p-6 xl:col-span-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-subtle">Billing summary</h3>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-ink-subtle">Default payment method</p>
              {billingLoading ? (
                <Skeleton className="mt-2 h-5 w-40" />
              ) : defaultMethod ? (
                <p className="mt-2 text-sm text-white">
                  {defaultMethod.brand.toUpperCase()} •••• {defaultMethod.last4}
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">No payment method added</p>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-ink-subtle">Invoices generated</p>
              <p className="mt-2 text-2xl font-bold text-white">{data?.invoices.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-ink-subtle">Open support requests</p>
              <p className="mt-2 text-2xl font-bold text-white">{pendingCount}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Invoices</h2>
        {billingLoading ? (
          <Skeleton className="h-44 w-full rounded-2xl" />
        ) : data && data.invoices.length > 0 ? (
          <InvoiceTable invoices={data.invoices} />
        ) : (
          <EmptyState title="No invoices yet" description="Invoices will appear here after your first successful payment." />
        )}
      </section>
    </div>
  );
}
