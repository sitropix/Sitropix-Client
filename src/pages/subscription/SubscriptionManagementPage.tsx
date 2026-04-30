import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { InvoiceTablePaged } from "@/components/subscription/InvoiceTablePaged";
import { useUser } from "@/context/UserContext";
import { useSubscriptionPortal } from "@/hooks/useSubscriptionPortal";
import { ApiRequestError } from "@/services/http";
import {
  cancelSubscription,
  createBillingPortalSession,
  pauseSubscription,
  resumeSubscription,
} from "@/services/subscriptionsApi";
import type { SubscriptionState } from "@/types/account";
import type { SubscriptionStatus } from "@/types/subscription";

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

function subscriptionControlFlags(status: SubscriptionStatus) {
  const canPause = status === "active" || status === "trialing" || status === "past_due";
  const canResume = status === "paused";
  const canCancel = canPause || canResume;
  return { canPause, canResume, canCancel };
}

function PlanIcon() {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand-lime/25 bg-brand-lime/[0.1] text-brand-lime shadow-sm">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M2.25 8.25h19.5M2.25 9.75h19.5M4.5 6.75h15a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0119.5 21.75h-15a2.25 2.25 0 01-2.25-2.25V9A2.25 2.25 0 014.5 6.75z" />
      </svg>
    </span>
  );
}

function CardIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-sm">
      {children}
    </span>
  );
}

export function SubscriptionManagementPage() {
  const { contact, subscription, portal, loading, error, refresh: refreshUser } = useUser();
  const { data: portalData, loading: portalLoading, error: portalError, refresh: refreshPortal } =
    useSubscriptionPortal();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingCount = subscription?.state === "past_due" ? 1 : 0;

  const subStatus = portalData?.subscription?.status;
  const controls = subStatus ? subscriptionControlFlags(subStatus) : null;
  const fc = portalData?.featureControls ?? { pauseResume: true, selfCancel: true };

  const invoices = portal?.invoices ?? [];
  const defaultMethod = portal?.paymentMethods?.find((pm) => pm.isDefault);

  async function openBillingPortal() {
    setBusy(true);
    setNotice(null);
    try {
      const { url } = await createBillingPortalSession(`${window.location.origin}/subscription-management`);
      if (url) window.location.assign(url);
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : "Billing portal needs a Stripe customer. Complete Checkout on the subscription page first, or use a dev trial.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSubscriptionState(action: "pause" | "resume" | "cancel") {
    setBusy(true);
    setNotice(null);
    try {
      if (action === "pause") await pauseSubscription();
      if (action === "resume") await resumeSubscription();
      if (action === "cancel") await cancelSubscription();
      await refreshPortal();
      await refreshUser();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setNotice(err.message || "Action failed");
      } else {
        setNotice(err instanceof Error ? err.message : "Action failed");
      }
    } finally {
      setBusy(false);
    }
  }

  const status = subscription?.state ?? "trialing";
  const statusTone =
    status === "active"
      ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300"
      : status === "past_due"
        ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
        : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-300";

  return (
    <div className="space-y-6 text-zinc-900 opacity-0 animate-fade-up [animation-fill-mode:forwards] lg:space-y-7">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Subscription Management" }]} />

      <header className="subscription-mgmt-hero relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-white via-zinc-50/80 to-zinc-100/50 px-5 py-5 shadow-sm sm:px-7 sm:py-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-sky-100/50 blur-2xl"
        />
        <div className="relative">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Workspace billing</p>
          <h1 className="mt-1.5 text-balance text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Subscription Management
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-zinc-600">
            Review your tier, Stripe billing portal, invoices, and subscription pause or cancel—all from this hub.
          </p>
        </div>
      </header>

      {error && <p className="rounded-xl border border-rose-400/40 bg-rose-100 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {portalError && (
        <p className="rounded-xl border border-rose-400/40 bg-rose-100 px-4 py-3 text-sm text-rose-800">{portalError}</p>
      )}
      {notice && <p className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-700">{notice}</p>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-start xl:gap-6">
        <section className="subscription-mgmt-main relative overflow-hidden rounded-2xl border border-zinc-200/95 bg-white shadow-glass xl:col-span-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-500/50 to-transparent" />
          <div className="flex flex-col gap-4 border-b border-zinc-300 bg-gradient-to-b from-zinc-50/95 to-zinc-100/60 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
            <div className="flex min-w-0 items-start gap-4">
              <PlanIcon />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">
                    {subscription?.planName ?? "No active plan"}
                  </h2>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone}`}>
                    {subscriptionLabel(status)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-zinc-600">
                  Renewal schedule and Stripe subscription status—a quick snapshot of your workspace plan.
                </p>
              </div>
            </div>
            <div className="subscription-next-billing shrink-0 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm sm:text-right">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Next billing</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-zinc-900">{formatDate(subscription?.renewsAt)}</p>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ) : (
              <div className="subscription-detail-shell overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/40 shadow-inner shadow-zinc-200/60">
                <div className="grid md:grid-cols-2 md:divide-x md:divide-zinc-200">
                  <div className="flex flex-col border-b border-zinc-200 p-4 sm:p-6 md:border-b-0 md:min-h-[11rem]">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Account</p>
                    {contact ? (
                      <dl className="mt-3 space-y-3.5 text-sm">
                        <div>
                          <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Name</dt>
                          <dd className="mt-1 font-medium text-zinc-900">
                            {contact.firstName} {contact.lastName}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Email</dt>
                          <dd className="mt-1 break-all font-medium text-zinc-900">{contact.email}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="mt-3 text-sm text-zinc-600">No account data available.</p>
                    )}
                  </div>
                  <div className="flex min-h-[11rem] flex-col p-4 sm:p-6">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Plans</p>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                        Compare tiers side by side and switch plans on the{" "}
                        <span className="font-medium text-zinc-800">Plans &amp; Addon</span> page.
                      </p>
                    </div>
                    <div className="mt-auto flex justify-end pt-5">
                      <Link
                        to="/subscription"
                        className="inline-flex min-h-[40px] min-w-[138px] items-center justify-center rounded-lg bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-zinc-800 hover:shadow-lg"
                      >
                        Change plan
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="subscription-mgmt-summary flex flex-col overflow-hidden rounded-2xl border border-zinc-200/95 bg-white shadow-glass xl:col-span-4">
          <div className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50/95 to-zinc-100/50 px-5 py-4">
            <h3 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Billing summary</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              Card on file, invoice count from Stripe, and support queue—not a full ledger.
            </p>
          </div>
          <div className="flex flex-1 flex-col divide-y divide-zinc-200">
            <div className="flex gap-3 px-5 py-4">
              <CardIcon>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M2.25 8.25h19.5M2.25 9.75h19.5M4.5 6.75h15a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0119.5 21.75h-15a2.25 2.25 0 01-2.25-2.25V9A2.25 2.25 0 014.5 6.75z" />
                </svg>
              </CardIcon>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-zinc-500">Default payment method</p>
                {loading ? (
                  <Skeleton className="mt-2 h-5 w-40" />
                ) : defaultMethod ? (
                  <p className="mt-1.5 font-mono text-sm font-semibold text-zinc-900">
                    {defaultMethod.brand.toUpperCase()} •••• {defaultMethod.last4}
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm text-zinc-600">No payment method on file</p>
                )}
              </div>
            </div>
            <div className="flex items-end justify-between gap-3 px-5 py-4">
              <div className="flex gap-3">
                <CardIcon>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664v.75h0V8.25m0 0v.375c0 .621.504 1.125 1.125 1.125h2.25c.621 0 1.125-.504 1.125-1.125v-.375m0 0V6.25m0 2.25V6.25m0 0h2.25m-2.25 0h-2.25" />
                  </svg>
                </CardIcon>
                <div>
                  <p className="text-[11px] font-medium text-zinc-500">Invoices recorded</p>
                  {loading ? (
                    <Skeleton className="mt-1 h-8 w-10" />
                  ) : (
                    <p className="mt-0.5 text-2xl font-bold tabular-nums leading-none text-zinc-900">{invoices.length}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between gap-3 px-5 py-4">
              <div className="flex gap-3">
                <CardIcon>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <path d="M16.862 4.487l2.687 2.687a3.875 3.875 0 010 5.478l-6.086 6.086a6 6 0 01-2.659 1.506l-.13.049a49.089 49.089 0 01-11.956 3.086 3 3 0 01-2.986-3.069l-.184-11.956a3 3 0 011.659-2.694l13.086-13.086a3.875 3.875 0 015.478 0z" />
                  </svg>
                </CardIcon>
                <div>
                  <p className="text-[11px] font-medium text-zinc-500">Outstanding support threads</p>
                  {loading ? (
                    <Skeleton className="mt-1 h-8 w-10" />
                  ) : (
                    <p className="mt-0.5 text-2xl font-bold tabular-nums leading-none text-zinc-900">{pendingCount}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {!portalLoading && portalData?.subscription ? (
        <section className="subscription-control-shell relative overflow-hidden rounded-2xl border border-zinc-200/95 bg-white shadow-glass ring-1 ring-zinc-50">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-400/50 to-transparent" />
          <div className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50/95 to-zinc-100/60 px-5 py-4 sm:px-6 sm:py-5">
            <h2 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Stripe &amp; subscription</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-700">
              Open Stripe Billing for payment methods, receipts, and renewal settings. Pause, resume, or cancel billing
              here. Changing your plan tier uses the{" "}
              <span className="font-medium text-zinc-900">Plans &amp; Addon</span> module above—compare tiers there before
              you pause or cancel.
            </p>
            {(!fc.pauseResume || !fc.selfCancel) && (
              <p className="mt-3 text-xs text-zinc-500">
                Some self-service actions are controlled by your workspace administrator.
              </p>
            )}
          </div>
          <div className="p-5 sm:p-6">
            <div className="subscription-control-panel rounded-xl border border-zinc-200/90 bg-gradient-to-br from-white to-zinc-50/50 p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
                <button
                  type="button"
                  onClick={() => void openBillingPortal()}
                  disabled={busy}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:opacity-50 xl:min-w-[17rem]"
                >
                  Open Stripe Billing Portal
                </button>
                {(fc.pauseResume || fc.selfCancel) && (
                  <div className="subscription-inline-actions flex min-w-0 flex-1 flex-wrap items-stretch justify-start gap-2 sm:justify-end xl:justify-end xl:gap-2">
                    {fc.pauseResume ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleSubscriptionState("pause")}
                          disabled={busy || !controls?.canPause}
                          title={!controls?.canPause ? "Pause is only available while the subscription is active." : undefined}
                          className="inline-flex min-h-[40px] min-w-[6.5rem] flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                        >
                          Pause
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSubscriptionState("resume")}
                          disabled={busy || !controls?.canResume}
                          title={!controls?.canResume ? "Resume is only available when billing is paused." : undefined}
                          className="inline-flex min-h-[40px] min-w-[6.5rem] flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                        >
                          Resume
                        </button>
                      </>
                    ) : null}
                    {fc.selfCancel ? (
                      <button
                        type="button"
                        onClick={() => void handleSubscriptionState("cancel")}
                        disabled={busy || !controls?.canCancel}
                        title={!controls?.canCancel ? "Nothing to cancel." : undefined}
                        className="inline-flex min-h-[40px] min-w-0 flex-1 items-center justify-center rounded-xl border border-rose-300/90 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[10rem] sm:flex-none"
                      >
                        Cancel subscription
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-zinc-200/95 bg-white shadow-glass">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 bg-gradient-to-b from-zinc-50/95 to-zinc-100/50 px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 id="invoices-heading" className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Invoice history
              </h2>
              {!loading && invoices.length > 0 ? (
                <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-700">
                  {invoices.length}
                </span>
              ) : null}
            </div>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-zinc-600">
              Paid invoices from Stripe: numbers, totals, status, and download where a PDF URL is available.
            </p>
          </div>
        </div>
        <div className="p-3 sm:p-4">
          {loading ? (
            <Skeleton className="h-44 w-full rounded-xl" />
          ) : invoices.length > 0 ? (
            <InvoiceTablePaged invoices={invoices} />
          ) : (
            <EmptyState
              title="No invoices yet"
              description="After Stripe records a paid charge for this workspace, invoice rows land here automatically."
            />
          )}
        </div>
      </section>
    </div>
  );
}
