import { useState } from "react";
import { Link } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { InvoiceTable } from "@/components/subscription/InvoiceTable";
import { useUser } from "@/context/UserContext";
import { createBillingPortalSession } from "@/services/subscriptionsApi";
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

function PlanIcon() {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand-lime/25 bg-brand-lime/[0.1] text-brand-lime">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M2.25 8.25h19.5M2.25 9.75h19.5M4.5 6.75h15a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0119.5 21.75h-15a2.25 2.25 0 01-2.25-2.25V9A2.25 2.25 0 014.5 6.75z" />
      </svg>
    </span>
  );
}

export function SubscriptionManagementPage() {
  const { contact, subscription, portal, loading, error, refresh } = useUser();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingCount = subscription?.state === "past_due" ? 1 : 0;

  const invoices = portal?.invoices ?? [];
  const defaultMethod = portal?.paymentMethods?.find((pm) => pm.isDefault);

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

  const status = subscription?.state ?? "trialing";
  const statusTone =
    status === "active"
      ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25"
      : status === "past_due"
        ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/25"
        : "bg-white/10 text-white ring-1 ring-white/15";

  return (
    <div className="space-y-8 opacity-0 animate-fade-up [animation-fill-mode:forwards]">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Subscription Management" }]} />

      <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-lime">Billing & plan</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Subscription Management</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Account, plan status, payment method, and invoices in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:border-brand-lime/35 hover:bg-white/[0.07]"
        >
          Refresh
        </button>
      </header>

      {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}
      {notice && <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-ink-muted">{notice}</p>}

      <div className="grid grid-cols-1 gap-6 lg:gap-8 xl:grid-cols-12">
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-[#0f1419] to-[#0b0f14] shadow-glass ring-1 ring-white/[0.05] xl:col-span-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-lime/60 to-transparent" />
          <div className="flex flex-col gap-4 border-b border-white/10 bg-black/25 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
            <div className="flex min-w-0 items-start gap-4">
              <PlanIcon />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                    {subscription?.planName ?? "No active plan"}
                  </h2>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone}`}>
                    {subscriptionLabel(status)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-ink-muted">Renewals, payments, and subscription lifecycle.</p>
              </div>
            </div>
            <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">Next billing</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-white">{formatDate(subscription?.renewsAt)}</p>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-white/[0.09] bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="grid md:grid-cols-2 md:divide-x md:divide-white/10">
                  <div className="border-b border-white/10 p-5 sm:p-6 md:border-b-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">Account</p>
                    {contact ? (
                      <dl className="mt-4 space-y-3 text-sm">
                        <div>
                          <dt className="text-xs text-ink-subtle">Name</dt>
                          <dd className="mt-0.5 font-medium text-white">
                            {contact.firstName} {contact.lastName}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-ink-subtle">Email</dt>
                          <dd className="mt-0.5 break-all font-medium text-white">{contact.email}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="mt-3 text-sm text-ink-muted">No account data available.</p>
                    )}
                  </div>
                  <div className="p-5 sm:p-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">Plan actions</p>
                    <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                      Change your plan here, or open Stripe for cards and receipts.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        to="/subscription"
                        className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white transition hover:border-brand-lime/40 hover:bg-white/[0.07]"
                      >
                        Change plan
                      </Link>
                      <button
                        type="button"
                        onClick={() => void openBillingPortal()}
                        disabled={busy}
                        className="inline-flex items-center justify-center rounded-lg bg-brand-lime px-4 py-2 text-xs font-semibold text-canvas shadow-glow transition hover:bg-brand-lime-dim disabled:opacity-50"
                      >
                        {busy ? "Opening…" : "Manage billing"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1016]/95 shadow-glass ring-1 ring-white/[0.04] xl:col-span-4">
          <div className="border-b border-white/10 bg-black/25 px-5 py-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">Billing summary</h3>
            <p className="mt-1 text-xs text-ink-muted">Snapshot of how you pay and what is open.</p>
          </div>
          <div className="flex flex-1 flex-col divide-y divide-white/10">
            <div className="px-5 py-4">
              <p className="text-xs text-ink-subtle">Default payment method</p>
              {loading ? (
                <Skeleton className="mt-2 h-5 w-40" />
              ) : defaultMethod ? (
                <p className="mt-2 font-mono text-sm font-medium text-white">
                  {defaultMethod.brand.toUpperCase()} •••• {defaultMethod.last4}
                </p>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">No payment method on file</p>
              )}
            </div>
            <div className="flex items-baseline justify-between gap-3 px-5 py-4">
              <p className="text-xs text-ink-subtle">Invoices generated</p>
              {loading ? (
                <Skeleton className="h-8 w-10" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-white">{invoices.length}</p>
              )}
            </div>
            <div className="flex items-baseline justify-between gap-3 px-5 py-4">
              <p className="text-xs text-ink-subtle">Open support requests</p>
              {loading ? (
                <Skeleton className="h-8 w-10" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-white">{pendingCount}</p>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1016]/95 shadow-glass ring-1 ring-white/[0.04]">
        <div className="border-b border-white/10 bg-black/25 px-5 py-4 sm:px-6">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">Invoices</h2>
          <p className="mt-1 text-xs text-ink-muted">Receipts and PDFs from completed charges.</p>
        </div>
        <div className="p-4 sm:p-5">
          {loading ? (
            <Skeleton className="h-44 w-full rounded-xl" />
          ) : invoices.length > 0 ? (
            <InvoiceTable invoices={invoices} />
          ) : (
            <EmptyState title="No invoices yet" description="Invoices will appear here after your first successful payment." />
          )}
        </div>
      </section>
    </div>
  );
}
