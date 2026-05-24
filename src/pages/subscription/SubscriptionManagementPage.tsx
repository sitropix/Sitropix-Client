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
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxPageHeader } from "@/components/sx/PageHeader";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";

type SubscriptionStatusVariant = "open" | "progress" | "review" | "resolved" | "closed" | "urgent" | "success" | "info" | "warning" | "danger" | "neutral" | "brand";

function statusVariant(state: string): SubscriptionStatusVariant {
  const s = String(state ?? "").toLowerCase();
  if (s === "active" || s === "trialing") return "success";
  if (s === "past_due") return "warning";
  if (s === "canceled") return "closed";
  if (s === "paused" || s === "collection_paused" || s === "collection paused")
    return "warning";
  return "neutral";
}

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

function RowSpinner({ label }: { label: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center text-[var(--text-tertiary)]"
      title={label}
    >
      <span
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--text-primary)]"
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function SubscriptionManagementPage() {
  const { portal, loading, error, refresh: refreshUser } = useUser();
  const toast = useSxToast();
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
        await syncFromStripe();
      } catch {
        /* best-effort */
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
    try {
      const { url } = await createBillingPortalSession(
        `${window.location.origin}/billing`,
        { projectId },
      );
      if (url) window.location.assign(url);
    } catch (err) {
      toast.error(
        "Couldn't open Stripe billing portal.",
        err instanceof Error ? err.message : undefined,
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
      toast.success("Subscription updated.");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        toast.error("Couldn't apply that change.", err.message);
      } else {
        toast.error(
          "Couldn't apply that change.",
          err instanceof Error ? err.message : undefined,
        );
      }
    } finally {
      setActionBusySubscriptionId(null);
    }
  }

  return (
    <div data-sx-root className="flex flex-col gap-6">
      <SxPageHeader
        title="Billing"
        description="Manage subscriptions, payment methods, and invoices for each of your projects."
      />

      {error ? (
        <div
          role="alert"
          className="rounded-sx-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-sx-sm text-[var(--color-danger-fg)]"
        >
          {error}
        </div>
      ) : null}

      <SxPanel
        title="Subscriptions"
        bodyClassName="p-0"
        padded={false}
      >
        {rowsLoading && rows.length === 0 ? (
          <div className="flex flex-col gap-3 p-5">
            {[0, 1, 2].map((k) => (
              <Skeleton key={k} className="h-32 w-full rounded-sx-md" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No subscriptions yet."
              description="Subscribe a project from its checkout to see it here."
            />
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {rows.map((row) => {
              const controls = subscriptionControlFlags(
                row.subscription.status,
                row.subscription.pausedAt,
              );
              const pm = row.paymentMethod;
              const projectTitle =
                row.project?.name ?? "Project subscription";
              const sid = row.subscription.id;
              const rowRefreshing = refreshingSubscriptionIds.has(sid);
              const rowActionBusy = actionBusySubscriptionId === sid;
              const portalOpening =
                portalBusyProjectId === row.subscription.projectId;
              return (
                <li
                  key={sid}
                  aria-busy={rowRefreshing || rowActionBusy}
                  className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {(rowRefreshing || rowActionBusy) && (
                        <RowSpinner
                          label={
                            rowRefreshing
                              ? "Refreshing subscription"
                              : "Applying changes"
                          }
                        />
                      )}
                      <h3 className="font-ui text-sx-md font-semibold text-[var(--text-primary)]">
                        {projectTitle}
                      </h3>
                      <SxBadge variant={statusVariant(row.subscription.status)}>
                        {subscriptionLabel(row.subscription.status)}
                      </SxBadge>
                    </div>
                    {rowRefreshing ? (
                      <Skeleton className="h-3 w-48" />
                    ) : (
                      <div className="flex flex-col gap-1 text-sx-sm text-[var(--text-secondary)]">
                        <p>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {row.plan?.name ?? "Unknown plan"}
                          </span>
                          <span className="text-[var(--text-tertiary)]">
                            {" "}
                            · {row.subscription.billingCycle}
                          </span>
                        </p>
                        <p className="text-sx-xs text-[var(--text-tertiary)]">
                          Next billing:{" "}
                          <span className="font-mono">
                            {formatDate(row.subscription.currentPeriodEnd)}
                          </span>
                          {" · Recurring: "}
                          {row.subscription.cancelAtPeriodEnd
                            ? "Stops at period end"
                            : "Enabled"}
                        </p>
                      </div>
                    )}

                    {/* Payment method */}
                    {rowRefreshing ? (
                      <Skeleton className="h-10 w-48" />
                    ) : pm ? (
                      <div className="flex items-center gap-3 rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2">
                        <div className="grid h-9 w-12 shrink-0 place-items-center rounded-sx-sm bg-[var(--color-ink-800)] font-mono text-sx-2xs font-bold uppercase text-white">
                          {(pm.brand || "?").slice(0, 4).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono text-sx-xs text-[var(--text-primary)]">
                            ···· {pm.last4}
                          </p>
                          <p className="font-mono text-sx-2xs text-[var(--text-tertiary)]">
                            {pm.expMonth > 0 && pm.expYear > 0
                              ? `Exp ${String(pm.expMonth).padStart(2, "0")}/${pm.expYear}`
                              : "Stripe default"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sx-xs text-[var(--text-tertiary)]">
                        No payment method on this subscription. Update via Stripe portal.
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 flex-wrap gap-2 md:max-w-xs md:justify-end">
                    <SxButton
                      variant="secondary"
                      size="sm"
                      loading={portalOpening}
                      disabled={
                        freezeSubscriptionControls && !portalOpening
                      }
                      onClick={() =>
                        void openBillingPortal(row.subscription.projectId)
                      }
                    >
                      {portalOpening ? "Opening…" : "Manage in Stripe"}
                    </SxButton>
                    {row.subscription.cancelAtPeriodEnd ? (
                      <SxButton
                        variant="secondary"
                        size="sm"
                        disabled={
                          freezeSubscriptionControls ||
                          row.subscription.status === "canceled"
                        }
                        onClick={() =>
                          void handleSubscriptionState("resume_recurring", row)
                        }
                      >
                        Resume renewal
                      </SxButton>
                    ) : (
                      <SxButton
                        variant="secondary"
                        size="sm"
                        disabled={
                          freezeSubscriptionControls ||
                          row.subscription.status === "canceled"
                        }
                        onClick={() =>
                          void handleSubscriptionState("stop_recurring", row)
                        }
                      >
                        Stop renewal
                      </SxButton>
                    )}
                    {controls.canPause ? (
                      <SxButton
                        variant="secondary"
                        size="sm"
                        disabled={freezeSubscriptionControls}
                        onClick={() =>
                          void handleSubscriptionState("pause_collection", row)
                        }
                      >
                        Pause
                      </SxButton>
                    ) : controls.canResume ? (
                      <SxButton
                        variant="secondary"
                        size="sm"
                        disabled={freezeSubscriptionControls}
                        onClick={() =>
                          void handleSubscriptionState("resume_collection", row)
                        }
                      >
                        Resume
                      </SxButton>
                    ) : null}
                    <SxButton
                      variant="danger"
                      size="sm"
                      disabled={
                        freezeSubscriptionControls || !controls.canCancel
                      }
                      onClick={() =>
                        void handleSubscriptionState("cancel", row)
                      }
                    >
                      Cancel
                    </SxButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SxPanel>

      <SxPanel
        title="Invoice history"
        action={
          !loading && invoices.length > 0 ? (
            <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
              {invoices.length} total
            </span>
          ) : null
        }
        padded={loading || invoices.length === 0}
        bodyClassName={loading || invoices.length === 0 ? "" : "p-0"}
      >
        {loading ? (
          <Skeleton className="h-32 w-full rounded-sx-md" />
        ) : invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <InvoiceTablePaged invoices={invoices} />
          </div>
        ) : (
          <EmptyState
            title="No invoices yet."
            description="Paid invoices will appear here automatically."
          />
        )}
      </SxPanel>
    </div>
  );
}
