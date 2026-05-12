import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { InvoiceTablePaged } from "@/components/subscription/InvoiceTablePaged";
import { useUser } from "@/context/UserContext";
import { ApiRequestError } from "@/services/http";
import {
  listProjectSubscriptionDetails,
  type ProjectSubscriptionDetailsRecord,
} from "@/services/projectsStore";
import {
  cancelSubscription,
  createBillingPortalSession,
  pauseSubscription,
  resumeRecurringSubscription,
  resumeSubscription,
  stopRecurringSubscription,
  syncFromStripe,
} from "@/services/subscriptionsApi";
import { useEffect, useRef, useState } from "react";

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
    case "collection_paused":
    case "collection paused":
      return "Paused";
    default:
      return state;
  }
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

function subscriptionControlFlags(status: string, pausedAt?: string | null) {
  const normalized = String(status ?? "").toLowerCase();
  const isCollectionPaused =
    normalized === "paused" ||
    normalized === "collection_paused" ||
    normalized === "collection paused" ||
    pausedAt != null;

  const canPause =
    !isCollectionPaused &&
    (normalized === "active" ||
      normalized === "trialing" ||
      normalized === "past_due");
  const canResume = isCollectionPaused;
  const canCancel = canPause || canResume;
  return { canPause, canResume, canCancel };
}

const SUBSCRIPTION_TABLE_SKELETON_ROWS = 3;

/** Column width ratio 1 : 1 : 2 : 3 (of table width). */
function SubscriptionTableColgroup() {
  return (
    <colgroup>
      <col className="w-[calc(100%/7)]" />
      <col className="w-[calc(100%/7)]" />
      <col className="w-[calc(150%/7)]" />
      <col className="w-[calc(350%/7)]" />
    </colgroup>
  );
}

function RowSpinner({ label }: { label: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center text-zinc-500"
      title={label}
    >
      <span
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700"
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function SubscriptionManagementPage() {
  const { portal, loading, error, refresh: refreshUser } = useUser();
  const [rows, setRows] = useState<ProjectSubscriptionDetailsRecord[]>([]);
  const rowsRef = useRef<ProjectSubscriptionDetailsRecord[]>([]);
  rowsRef.current = rows;
  const [rowsLoading, setRowsLoading] = useState(true);
  const [refreshingSubscriptionIds, setRefreshingSubscriptionIds] = useState<
    Set<string>
  >(() => new Set());
  const [actionBusySubscriptionId, setActionBusySubscriptionId] = useState<
    string | null
  >(null);
  const [portalBusyProjectId, setPortalBusyProjectId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const invoices = portal?.invoices ?? [];

  const freezeSubscriptionControls =
    actionBusySubscriptionId != null || refreshingSubscriptionIds.size > 0;

  async function reloadRows() {
    const idsBefore = rowsRef.current.map((r) => r.subscription.id);
    setRowsLoading(true);
    if (idsBefore.length > 0) {
      setRefreshingSubscriptionIds(new Set(idsBefore));
    }
    try {
      setRows(await listProjectSubscriptionDetails());
    } finally {
      setRowsLoading(false);
      setRefreshingSubscriptionIds(new Set());
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Ensure the UI reflects real Stripe state (including "Collection Paused")
        // even when changes happen outside this app.
        await syncFromStripe();
      } catch {
        /* best-effort; we still render local DB state */
      }
      if (cancelled) return;
      await reloadRows();
      if (cancelled) return;
      await refreshUser();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  async function openBillingPortal(projectId: string) {
    setPortalBusyProjectId(projectId);
    setNotice(null);
    try {
      const { url } = await createBillingPortalSession(
        `${window.location.origin}/subscription-management`,
        { projectId },
      );
      if (url) {
        window.location.assign(url);
      }
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Unable to open billing portal.",
      );
    } finally {
      setPortalBusyProjectId(null);
    }
  }

  async function handleSubscriptionState(
    action:
      | "pause_collection"
      | "resume_collection"
      | "stop_recurring"
      | "resume_recurring"
      | "cancel",
    row: ProjectSubscriptionDetailsRecord,
  ) {
    setActionBusySubscriptionId(row.subscription.id);
    setNotice(null);
    try {
      const payload = { projectId: row.subscription.projectId };
      if (action === "pause_collection") await pauseSubscription(payload);
      if (action === "resume_collection") await resumeSubscription(payload);
      if (action === "stop_recurring")
        await stopRecurringSubscription(row.subscription.projectId);
      if (action === "resume_recurring")
        await resumeRecurringSubscription(row.subscription.projectId);
      if (action === "cancel") await cancelSubscription(payload);
      await syncFromStripe(payload);
      setActionBusySubscriptionId(null);
      await reloadRows();
      await refreshUser();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setNotice(err.message || "Action failed");
      } else {
        setNotice(err instanceof Error ? err.message : "Action failed");
      }
    } finally {
      setActionBusySubscriptionId(null);
    }
  }

  return (
    <div className="space-y-6 text-zinc-900 opacity-0 animate-fade-up [animation-fill-mode:forwards] lg:space-y-7">
      <Breadcrumb
        items={[
          { label: "Home", to: "/dashboard" },
          { label: "Payment Management" },
        ]}
      />

      <header className="subscription-mgmt-hero relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-white via-zinc-50/80 to-zinc-100/50 px-5 py-5 shadow-sm sm:px-7 sm:py-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-sky-100/50 blur-2xl"
        />
        <div className="relative">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Workspace billing
          </p>
          <h1 className="mt-1.5 text-balance text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Payment Management
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-zinc-600">
            Manage subscriptions per project, payment methods, recurring
            controls, and invoices.
          </p>
        </div>
      </header>

      {error && (
        <p className="rounded-xl border border-rose-400/40 bg-rose-100 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-700">
          {notice}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-zinc-200/95 bg-white shadow-glass">
        <div className="border-b border-zinc-200 bg-gradient-to-r from-zinc-50 to-white px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            Subscriptions and Payment Methods
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-600">
            Each row is one project subscription: plan and billing controls, the
            default card Stripe has on that subscription, and actions including
            the billing portal to update payment methods.
          </p>
        </div>
        <div className="overflow-x-auto p-3 sm:p-4">
          {rowsLoading && rows.length === 0 ? (
            <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
              <SubscriptionTableColgroup />
              <thead>
                <tr className="border-b border-zinc-200 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2 font-medium">Project</th>
                  <th className="px-3 py-2 font-medium">Subscription</th>
                  <th className="px-3 py-2 font-medium">Payment method</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {Array.from({ length: SUBSCRIPTION_TABLE_SKELETON_ROWS }).map(
                  (_, i) => (
                    <tr key={`sk-${i}`}>
                      <td className="px-3 py-3 align-top">
                        <Skeleton className="h-4 w-36 rounded" />
                        <Skeleton className="mt-2 h-3 w-28 rounded" />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Skeleton className="h-4 w-44 rounded" />
                        <Skeleton className="mt-2 h-3 w-40 rounded" />
                        <Skeleton className="mt-2 h-3 w-32 rounded" />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                          <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className="h-3 w-full max-w-[140px] rounded" />
                            <Skeleton className="h-3 w-24 rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          <Skeleton className="h-8 w-28 rounded-lg" />
                          <Skeleton className="h-8 w-24 rounded-lg" />
                          <Skeleton className="h-8 w-28 rounded-lg" />
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No subscriptions yet"
              description="Create a project and subscribe from its checkout flow. Payment methods and controls will appear in this table."
            />
          ) : (
            <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
              <SubscriptionTableColgroup />
              <thead>
                <tr className="border-b border-zinc-200 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2 font-medium">Project</th>
                  <th className="px-3 py-2 font-medium">Subscription</th>
                  <th className="px-3 py-2 font-medium">Payment method</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((row) => {
                  const controls = subscriptionControlFlags(
                    row.subscription.status,
                    row.subscription.pausedAt,
                  );
                  const pm = row.paymentMethod;
                  const projectTitle =
                    row.project?.name ?? "Workspace subscription";
                  const sid = row.subscription.id;
                  const rowRefreshing = refreshingSubscriptionIds.has(sid);
                  const rowActionBusy = actionBusySubscriptionId === sid;
                  const portalOpening =
                    portalBusyProjectId === row.subscription.projectId;
                  const portalLabel = portalOpening
                    ? "Opening…"
                    : "Update in Stripe portal";

                  return (
                    <tr
                      key={sid}
                      aria-busy={rowRefreshing || rowActionBusy}
                      className={`bg-white transition-colors ${rowRefreshing ? "bg-zinc-50/90" : ""} ${rowActionBusy ? "bg-sky-50/40" : ""}`}
                    >
                      <td className="px-3 py-3 align-top text-zinc-900">
                        <div className="flex items-start gap-2">
                          {(rowRefreshing || rowActionBusy) && (
                            <RowSpinner
                              label={
                                rowRefreshing
                                  ? "Refreshing subscription data"
                                  : "Applying changes"
                              }
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold leading-snug">
                              {projectTitle}
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              Invoices (stored): {row.invoices.length}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-zinc-700">
                        {rowRefreshing ? (
                          <div className="space-y-2">
                            <Skeleton className="h-3.5 w-40 rounded" />
                            <Skeleton className="h-3.5 w-36 rounded" />
                            <Skeleton className="h-3.5 w-32 rounded" />
                          </div>
                        ) : (
                          <>
                            <p className="text-xs leading-relaxed">
                              <span className="font-medium text-zinc-900">
                                {row.plan?.name ?? "Unknown plan"}
                              </span>
                              <span className="text-zinc-500">
                                {" "}
                                · {row.subscription.billingCycle}
                              </span>
                              <span className="text-zinc-500"> · </span>
                              <span className="font-medium text-zinc-800">
                                {subscriptionLabel(row.subscription.status)}
                              </span>
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                              Next billing:{" "}
                              {formatDate(row.subscription.currentPeriodEnd)}
                            </p>
                            <p className="mt-0.5 text-xs text-zinc-500">
                              Recurring:{" "}
                              {row.subscription.cancelAtPeriodEnd
                                ? "Stops at period end"
                                : "Enabled"}
                            </p>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {rowRefreshing ? (
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                            <div className="min-w-0 flex-1 space-y-2">
                              <Skeleton className="h-3 w-28 rounded" />
                              <Skeleton className="h-3 w-20 rounded" />
                            </div>
                          </div>
                        ) : pm ? (
                          <div className="flex items-start gap-2">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-900 text-[10px] font-bold uppercase tracking-wide text-white">
                              {(pm.brand || "?").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-zinc-900">
                                {pm.brand.toUpperCase()} ···· {pm.last4}
                              </p>
                              {pm.expMonth > 0 && pm.expYear > 0 ? (
                                <p className="mt-0.5 text-[11px] text-zinc-500">
                                  Exp {String(pm.expMonth).padStart(2, "0")}/
                                  {pm.expYear}
                                </p>
                              ) : (
                                <p className="mt-0.5 text-[11px] text-zinc-500">
                                  Stripe default on subscription
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="max-w-[200px] text-xs leading-relaxed text-zinc-600">
                            No card on this subscription in Stripe, or it could
                            not be loaded. Use the portal to add one.
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {rowRefreshing ? (
                          <div className="flex flex-wrap gap-2">
                            <Skeleton className="h-8 w-32 rounded-lg" />
                            <Skeleton className="h-8 w-24 rounded-lg" />
                            <Skeleton className="h-8 w-28 rounded-lg" />
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-zinc-50 disabled:opacity-50"
                              onClick={() =>
                                void openBillingPortal(
                                  row.subscription.projectId,
                                )
                              }
                              disabled={
                                portalOpening || freezeSubscriptionControls
                              }
                            >
                              {portalLabel}
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                              onClick={() =>
                                void handleSubscriptionState(
                                  "stop_recurring",
                                  row,
                                )
                              }
                              disabled={
                                freezeSubscriptionControls ||
                                row.subscription.cancelAtPeriodEnd ||
                                row.subscription.status === "canceled"
                              }
                            >
                              Stop Recurring
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                              onClick={() =>
                                void handleSubscriptionState(
                                  "resume_recurring",
                                  row,
                                )
                              }
                              disabled={
                                freezeSubscriptionControls ||
                                !row.subscription.cancelAtPeriodEnd ||
                                row.subscription.status === "canceled"
                              }
                            >
                              Resume Recurring
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                              onClick={() =>
                                void handleSubscriptionState(
                                  "pause_collection",
                                  row,
                                )
                              }
                              disabled={
                                freezeSubscriptionControls || !controls.canPause
                              }
                            >
                              Pause Collection
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                              onClick={() =>
                                void handleSubscriptionState(
                                  "resume_collection",
                                  row,
                                )
                              }
                              disabled={
                                freezeSubscriptionControls ||
                                !controls.canResume
                              }
                            >
                              Resume Collection
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-40"
                              onClick={() =>
                                void handleSubscriptionState("cancel", row)
                              }
                              disabled={
                                freezeSubscriptionControls ||
                                !controls.canCancel
                              }
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200/95 bg-white shadow-glass">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 bg-gradient-to-b from-zinc-50/95 to-zinc-100/50 px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <div className="flex flex-wrap items-baseline gap-2">
              <h2
                id="invoices-heading"
                className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
              >
                Invoice history
              </h2>
              {!loading && invoices.length > 0 ? (
                <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-700">
                  {invoices.length}
                </span>
              ) : null}
            </div>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-zinc-600">
              Paid invoices from Stripe: numbers, totals, status, and download
              where a PDF URL is available.
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
