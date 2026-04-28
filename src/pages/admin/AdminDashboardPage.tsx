import { useEffect, useState } from "react";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import { Skeleton } from "@/components/Skeleton";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { isModuleForbiddenError } from "@/services/http";
import { fetchAnalytics, fetchTransactions, retryFailedPayment } from "@/services/subscriptionsApi";
import type { AnalyticsSummary } from "@/types/subscription";

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export function AdminDashboardPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [transactions, setTransactions] = useState<Array<{ id: string; amountCents: number; status: string; invoiceNumber: string; failureReason?: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [noModuleAccess, setNoModuleAccess] = useState(false);

  async function load() {
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
      }
    } finally {
      setLoading(false);
    }
  }

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
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-white">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-neutral-400">Monitor revenue, subscriptions, platform signals, and payment health.</p>
      </header>

      {loading ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((k) => (
              <article key={k} className="rounded-xl border border-[#24292E] bg-[#15191C] p-5 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-16" />
              </article>
            ))}
          </section>
          <section className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-xl border border-[#24292E] bg-[#15191C] lg:col-span-8">
              <div className="border-b border-[#24292E] px-5 py-4">
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="space-y-3 p-4">
                {[0, 1, 2, 3].map((k) => (
                  <div key={k} className="flex items-center justify-between rounded-lg border border-[#24292E] bg-[#1C2126] px-4 py-3">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4 lg:col-span-4">
              <div className="rounded-xl border border-[#24292E] bg-[#15191C] p-5 space-y-4">
                <Skeleton className="h-4 w-28" />
                <div className="space-y-3">
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              </div>
              <div className="rounded-xl border border-[#24292E] bg-[#15191C] p-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3].map((k) => (
                    <Skeleton key={k} className="h-10 rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          {analytics && (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-xl border border-[#24292E] bg-[#15191C] p-5">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Total Revenue</p>
                <p className="mt-2 text-2xl font-bold text-white">{money(analytics.totalRevenueCents)}</p>
                <p className="mt-1 text-xs text-secondary">+12% from last month</p>
              </article>
              <article className="rounded-xl border border-[#24292E] bg-[#15191C] p-5">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Active Subscriptions</p>
                <p className="mt-2 text-2xl font-bold text-white">{analytics.activeSubscriptions}</p>
                <p className="mt-1 text-xs text-secondary">+5% growth</p>
              </article>
              <article className="rounded-xl border border-[#24292E] bg-[#15191C] p-5">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Churn Rate</p>
                <p className="mt-2 text-2xl font-bold text-white">{analytics.churnRate}%</p>
                <p className="mt-1 text-xs text-secondary">Trending down</p>
              </article>
              <article className="rounded-xl border border-[#24292E] bg-[#15191C] p-5">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Failed Payments</p>
                <p className="mt-2 text-2xl font-bold text-white">{analytics.failedPayments}</p>
                <p className="mt-1 text-xs text-neutral-400">Needs retry workflow</p>
              </article>
            </section>
          )}

          <section className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-xl border border-[#24292E] bg-[#15191C] lg:col-span-8">
              <div className="border-b border-[#24292E] px-5 py-4">
                <h2 className="text-base font-semibold text-white">Recent Activity</h2>
              </div>
              <div className="space-y-3 p-4">
                {transactions.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-500">No recent transactions</p>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#24292E] bg-[#1C2126] px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{tx.invoiceNumber}</p>
                        <p className="text-xs text-neutral-400">{money(tx.amountCents)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs capitalize text-neutral-400">{tx.status}</span>
                        {tx.status === "failed" && (
                          <button
                            type="button"
                            onClick={() => void retryFailedPayment(tx.id).then(load)}
                            className="rounded-lg border border-brand-lime/40 px-3 py-1.5 text-xs font-medium text-brand-lime transition hover:bg-brand-lime/10"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4 lg:col-span-4">
              <div className="rounded-xl border border-[#24292E] bg-[#15191C] p-5">
                <h3 className="text-sm font-semibold text-white">Platform Health</h3>
                <div className="mt-4 space-y-4 text-xs">
                  <div>
                    <div className="mb-1 flex justify-between text-neutral-400">
                      <span>API Latency</span>
                      <span className="text-brand-lime">42ms</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#24292E]">
                      <div className="h-1.5 w-[85%] rounded-full bg-brand-lime" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-neutral-400">
                      <span>Uptime</span>
                      <span className="text-secondary">99.98%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#24292E]">
                      <div className="h-1.5 w-[99%] rounded-full bg-secondary" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#24292E] bg-[#15191C] p-5">
                <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-3 text-xs text-neutral-300">Broadcast</button>
                  <button className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-3 text-xs text-neutral-300">Export CSV</button>
                  <button className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-3 text-xs text-neutral-300">Reset Access</button>
                  <button className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-3 text-xs text-neutral-300">Permissions</button>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
