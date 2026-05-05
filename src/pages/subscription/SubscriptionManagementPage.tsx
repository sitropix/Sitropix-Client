import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { InvoiceTablePaged } from "@/components/subscription/InvoiceTablePaged";
import { useUser } from "@/context/UserContext";
import { ApiRequestError } from "@/services/http";
import {
  cancelSubscription,
  createBillingPortalSession,
  pauseSubscription,
  resumeSubscription,
  resumeRecurringSubscription,
  stopRecurringSubscription,
  syncFromStripe
} from "@/services/subscriptionsApi";
import {
  listProjectSubscriptionDetails,
  type ProjectSubscriptionDetailsRecord,
} from "@/services/projectsStore";
import type { SubscriptionStatus } from "@/types/subscription";

function subscriptionLabel(state: string) {
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

export function SubscriptionManagementPage() {
  const { portal, loading, error, refresh: refreshUser } = useUser();
  const [rows, setRows] = useState<ProjectSubscriptionDetailsRecord[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const invoices = portal?.invoices ?? [];
  const defaultMethod = portal?.paymentMethods?.find((pm) => pm.isDefault);

  async function reloadRows() {
    setRowsLoading(true);
    try {
      setRows(await listProjectSubscriptionDetails());
    } finally {
      setRowsLoading(false);
    }
  }

  useEffect(() => {
    void reloadRows();
  }, []);

  async function openBillingPortal(projectId?: string) {
    setBusy(true);
    setNotice(null);
    try {
      const { url } = await createBillingPortalSession(`${window.location.origin}/subscription-management`, projectId ? { projectId } : undefined);
      if (url) {
        window.location.assign(url);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to open billing portal.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubscriptionState(
    action: "pause_collection" | "resume_collection" | "stop_recurring" | "resume_recurring" | "cancel",
    row: ProjectSubscriptionDetailsRecord,
  ) {
    setBusy(true);
    setNotice(null);
    try {
      const payload = { projectId: row.subscription.projectId };
      if (action === "pause_collection") await pauseSubscription(payload);
      if (action === "resume_collection") await resumeSubscription(payload);
      if (action === "stop_recurring") await stopRecurringSubscription(row.subscription.projectId);
      if (action === "resume_recurring") await resumeRecurringSubscription(row.subscription.projectId);
      if (action === "cancel") await cancelSubscription(payload);
      await syncFromStripe(payload);
      await reloadRows();
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

  return (
    <div className="space-y-6 text-zinc-900 opacity-0 animate-fade-up [animation-fill-mode:forwards] lg:space-y-7">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Payment Management" }]} />

      <header className="subscription-mgmt-hero relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-white via-zinc-50/80 to-zinc-100/50 px-5 py-5 shadow-sm sm:px-7 sm:py-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-sky-100/50 blur-2xl"
        />
        <div className="relative">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Workspace billing</p>
          <h1 className="mt-1.5 text-balance text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Payment Management
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-zinc-600">
            Manage subscriptions per project, payment methods, recurring controls, and invoices.
          </p>
        </div>
      </header>

      {error && <p className="rounded-xl border border-rose-400/40 bg-rose-100 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {notice && <p className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-700">{notice}</p>}

      <section className="rounded-2xl border border-zinc-200/95 bg-white shadow-glass">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">Payment Method</h2>
          {loading ? (
            <Skeleton className="mt-2 h-5 w-48" />
          ) : defaultMethod ? (
            <p className="mt-1.5 text-sm text-zinc-700">
              Default: <span className="font-semibold">{defaultMethod.brand.toUpperCase()} •••• {defaultMethod.last4}</span>
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-zinc-600">No default method found.</p>
          )}
          <button
            type="button"
            onClick={() => void openBillingPortal(rows[0]?.subscription.projectId)}
            disabled={busy || rows.length === 0}
            className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Update Payment Method
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200/95 bg-white shadow-glass">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">Project Subscriptions</h2>
          <p className="mt-1 text-xs text-zinc-600">Manage each project subscription independently.</p>
        </div>
        <div className="p-4">
          {rowsLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : rows.length === 0 ? (
            <EmptyState title="No subscriptions yet" description="Create a project and subscribe from its checkout flow." />
          ) : (
            <div className="space-y-3">
              {rows.map((row) => {
                const controls = subscriptionControlFlags(row.subscription.status);
                return (
                  <article key={row.subscription.id} className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{row.project?.name ?? "Workspace Subscription"}</p>
                        <p className="text-xs text-zinc-600">
                          {row.plan?.name ?? "Unknown plan"} · {row.subscription.billingCycle} · {subscriptionLabel(row.subscription.status)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">Next billing: {formatDate(row.subscription.currentPeriodEnd)}</p>
                        <p className="text-xs text-zinc-500">Invoices: {row.invoices.length}</p>
                        <p className="text-xs text-zinc-500">
                          Recurring: {row.subscription.cancelAtPeriodEnd ? "Stops at period end" : "Enabled"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold"
                          onClick={() => void openBillingPortal(row.subscription.projectId)}
                          disabled={busy}
                        >
                          Billing Portal
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                          onClick={() => void handleSubscriptionState("stop_recurring", row)}
                          disabled={busy || row.subscription.cancelAtPeriodEnd || row.subscription.status === "canceled"}
                        >
                          Stop Recurring
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                          onClick={() => void handleSubscriptionState("resume_recurring", row)}
                          disabled={busy || !row.subscription.cancelAtPeriodEnd || row.subscription.status === "canceled"}
                        >
                          Resume Recurring
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                          onClick={() => void handleSubscriptionState("pause_collection", row)}
                          disabled={busy || !controls.canPause}
                        >
                          Pause Collection
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                          onClick={() => void handleSubscriptionState("resume_collection", row)}
                          disabled={busy || !controls.canResume}
                        >
                          Resume Collection
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-40"
                          onClick={() => void handleSubscriptionState("cancel", row)}
                          disabled={busy || !controls.canCancel}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

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
