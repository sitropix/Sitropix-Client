import { useEffect, useState } from "react";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import { Skeleton } from "@/components/Skeleton";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { isModuleForbiddenError, userFacingApiError } from "@/services/http";
import {
  fetchAnalytics,
  fetchTransactions,
  retryFailedPayment,
} from "@/services/subscriptionsApi";
import type { AnalyticsSummary } from "@/types/subscription";
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxMetricCard } from "@/components/sx/MetricCard";
import { SxPanel } from "@/components/sx/Panel";

function money(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function AdminDashboardPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [transactions, setTransactions] = useState<
    Array<{
      id: string;
      amountCents: number;
      status: string;
      invoiceNumber: string;
      failureReason?: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [noModuleAccess, setNoModuleAccess] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoadError(null);
    setLoading(!(analytics || transactions.length));
    setNoModuleAccess(false);
    try {
      const [a, t] = await Promise.all([fetchAnalytics(), fetchTransactions()]);
      setAnalytics(a);
      setTransactions(t);
      updateCache({ analytics: a, transactions: t });
    } catch (err) {
      if (isModuleForbiddenError(err)) {
        setNoModuleAccess(true);
      } else {
        setLoadError(
          userFacingApiError(err, "Couldn't load dashboard data."),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    document.title = "Admin · Sitropix";
  }, []);

  useEffect(() => {
    if (cache.analytics) setAnalytics(cache.analytics);
    if (cache.transactions) setTransactions(cache.transactions);
    if (cache.analytics && cache.transactions) {
      setLoading(false);
      return;
    }
    void load();
  }, []);

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Dashboard Analytics" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-[var(--border-subtle)] pb-4">
        <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Operations
        </p>
        <h1 className="mt-1.5 font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          Admin
        </h1>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">
          Revenue, subscriptions, platform health, and payment status.
        </p>
      </header>

      {loadError ? (
        <div
          className="rounded-sx-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-sx-sm text-[var(--color-danger-fg)]"
          role="alert"
        >
          {loadError}
        </div>
      ) : null}

      {loading ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((k) => (
              <Skeleton key={k} className="h-24 rounded-sx-lg" />
            ))}
          </section>
          <section className="grid gap-4 lg:grid-cols-12">
            <Skeleton className="h-72 rounded-sx-lg lg:col-span-8" />
            <Skeleton className="h-72 rounded-sx-lg lg:col-span-4" />
          </section>
        </>
      ) : (
        <>
          {analytics ? (
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SxMetricCard
                label="Total revenue"
                value={money(analytics.totalRevenueCents)}
                meta={<span className="text-[var(--color-success-fg)]">+12% MoM</span>}
              />
              <SxMetricCard
                label="Active subscriptions"
                value={analytics.activeSubscriptions}
                meta={<span className="text-[var(--color-success-fg)]">+5% growth</span>}
              />
              <SxMetricCard
                label="Churn rate"
                value={`${analytics.churnRate}%`}
                meta={<span>Trending down</span>}
              />
              <SxMetricCard
                label="Failed payments"
                value={analytics.failedPayments}
                meta={
                  analytics.failedPayments > 0 ? (
                    <SxBadge variant="urgent">Needs retry</SxBadge>
                  ) : (
                    <SxBadge variant="success">All current</SxBadge>
                  )
                }
              />
            </section>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-12">
            <SxPanel title="Recent activity" className="lg:col-span-8" padded={false}>
              {transactions.length === 0 ? (
                <p className="px-5 py-6 text-center text-sx-sm text-[var(--text-tertiary)]">
                  No recent transactions.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {transactions.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sx-xs text-[var(--text-tertiary)]">
                          {tx.invoiceNumber}
                        </p>
                        <p className="font-mono text-sx-sm text-[var(--text-primary)]">
                          {money(tx.amountCents)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <SxBadge
                          variant={
                            tx.status === "succeeded"
                              ? "success"
                              : tx.status === "failed"
                                ? "danger"
                                : "neutral"
                          }
                        >
                          {tx.status === "succeeded"
                            ? "Paid"
                            : tx.status === "failed"
                              ? "Failed"
                              : tx.status}
                        </SxBadge>
                        {tx.status === "failed" ? (
                          <SxButton
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void retryFailedPayment(tx.id).then(load)
                            }
                          >
                            Retry
                          </SxButton>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SxPanel>

            <SxPanel title="Platform health" className="lg:col-span-4">
              <div className="flex flex-col gap-4 text-sx-xs">
                <div>
                  <div className="mb-1 flex justify-between text-[var(--text-secondary)]">
                    <span>API latency</span>
                    <span className="font-mono text-[var(--color-success-fg)]">
                      42ms
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-ink-100)]">
                    <div
                      className="h-full w-[85%] rounded-full bg-[var(--color-success-500)]"
                      aria-hidden
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[var(--text-secondary)]">
                    <span>Uptime</span>
                    <span className="font-mono text-[var(--color-success-fg)]">
                      99.98%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-ink-100)]">
                    <div
                      className="h-full w-[99%] rounded-full bg-[var(--color-success-500)]"
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
            </SxPanel>
          </section>
        </>
      )}
    </div>
  );
}
