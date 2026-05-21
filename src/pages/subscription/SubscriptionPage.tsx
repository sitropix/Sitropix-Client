import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { PricingCard } from "@/components/subscription/PricingCard";
import {
  addonCatalogDisplayCents,
  addonCatalogDisplayDesc,
  addonPriceCycleSuffix,
  formatAddonMoney,
} from "@/lib/addonDisplayHelpers";
import type { BillingCycle, SubscriptionAddon } from "@/types/subscription";
import { useSubscriptionPortal } from "@/hooks/useSubscriptionPortal";

export function SubscriptionPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useSubscriptionPortal();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const visiblePlans = useMemo(() => data?.plans ?? [], [data?.plans]);
  const addons = useMemo(() => data?.addons ?? [], [data?.addons]);

  const anyMonthly = useMemo(
    () => visiblePlans.some((p) => p.billingMonthlyEnabled !== false),
    [visiblePlans],
  );
  const anyYearly = useMemo(
    () => visiblePlans.some((p) => p.billingYearlyEnabled !== false),
    [visiblePlans],
  );
  const showBillingToggle = anyMonthly || anyYearly;

  const anyAddonMonthly = useMemo(
    () => addons.some((a) => a.billingMonthlyEnabled !== false),
    [addons],
  );
  const anyAddonYearly = useMemo(
    () => addons.some((a) => a.billingYearlyEnabled !== false),
    [addons],
  );

  useEffect(() => {
    if (!anyMonthly && anyYearly) setBillingCycle("yearly");
    else if (anyMonthly && !anyYearly) setBillingCycle("monthly");
  }, [anyMonthly, anyYearly]);

  return (
    <div className="space-y-5 text-zinc-900 opacity-0 animate-fade-up [animation-fill-mode:forwards]">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Plan catalog" }]} />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="subscription-mgmt-hero relative min-w-0 overflow-hidden rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-white via-zinc-50/80 to-zinc-100/50 px-4 py-4 shadow-sm sm:flex-1 sm:px-6 sm:py-5">
          <div aria-hidden className="pointer-events-none absolute -right-10 top-0 h-24 w-24 rounded-full bg-brand-lime/[0.07] blur-3xl" />
          <div className="relative">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Plan &amp; add-on catalog</p>
            <h1 className="mt-1 text-balance text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
              Compare plans and add-ons
            </h1>
            <p className="mt-1.5 max-w-2xl text-pretty text-sm leading-snug text-zinc-600">
              Reference pricing only — not tied to a billed project. Subscribe or change plans from a project&apos;s
              checkout or Payment Management.
            </p>
          </div>
        </div>
        <div
          className="shrink-0 rounded-2xl border border-zinc-200 bg-white/90 p-2 shadow-sm ring-1 ring-zinc-100"
          role="group"
          aria-label="Billing cycle"
        >
          {showBillingToggle ? (
            <>
              <p className="px-2 pb-2 pt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Billing cycle</p>
              <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100/80 p-0.5">
                {anyMonthly ? (
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 sm:min-w-[5.5rem] sm:text-sm ${
                      billingCycle === "monthly" ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Monthly
                  </button>
                ) : null}
                {anyYearly ? (
                  <button
                    type="button"
                    onClick={() => setBillingCycle("yearly")}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 sm:min-w-[5.5rem] sm:text-sm ${
                      billingCycle === "yearly" ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Yearly
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="max-w-[14rem] px-2 py-2 text-[10px] font-medium leading-snug text-zinc-600">
              All listed plans are one-time purchases; recurring cycle controls are hidden.
            </p>
          )}
        </div>
      </header>

      {error && <p className="rounded-xl border border-rose-400/40 bg-rose-100 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {!loading && visiblePlans.length === 0 && (
        <EmptyState title="No plans available" description="Plans are currently unavailable. Try again shortly." />
      )}

      {loading && (
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-[300px] w-full rounded-2xl" />
          <Skeleton className="h-[300px] w-full rounded-2xl" />
          <Skeleton className="h-[300px] w-full rounded-2xl" />
        </div>
      )}

      {!loading && visiblePlans.length > 0 && (
        <section className="rounded-2xl border border-zinc-200/90 bg-white/40 p-4 shadow-sm ring-1 ring-zinc-100/80 sm:p-5">
          <div className="mb-4 flex flex-col gap-1 border-b border-zinc-200/80 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Plans</h2>
              <p className="mt-0.5 text-sm font-medium text-zinc-800">Tiers and included capabilities</p>
            </div>
            <p className="text-xs text-zinc-600">
              {showBillingToggle
                ? "Prices reflect your selected billing cycle above."
                : "One-time plans show the purchase price from the monthly price field."}
            </p>
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {visiblePlans.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                cycle={billingCycle}
                isCurrent={false}
                loading={false}
                primaryActionLabel="Subscribe from a project"
                onSelect={() => navigate("/projects")}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && addons.length > 0 && (
        <section className="rounded-2xl border border-zinc-200/90 bg-white/40 p-4 shadow-sm ring-1 ring-zinc-100/80 sm:p-5">
          <div className="mb-3 flex flex-col gap-1 border-b border-zinc-200/80 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Add-ons</h2>
              <p className="mt-0.5 text-sm font-medium text-zinc-800">Optional extras at project checkout</p>
            </div>
            <p className="text-xs text-zinc-600">
              {showBillingToggle && (anyAddonMonthly || anyAddonYearly)
                ? "Prices reflect your selected billing cycle above."
                : "One-time add-ons show the purchase price."}
            </p>
          </div>
          <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {addons.map((addon: SubscriptionAddon) => (
              <article
                key={addon.code}
                className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ring-1 ring-zinc-100/80"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{addon.code}</p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-900">{addon.label}</h3>
                <p className="mt-2 text-sm leading-snug text-zinc-600">
                  {addonCatalogDisplayDesc(addon, billingCycle, visiblePlans)}
                </p>
                <p className="mt-3 text-lg font-bold text-zinc-900">
                  {formatAddonMoney(
                    addonCatalogDisplayCents(addon, billingCycle, visiblePlans),
                    addon.currency || "USD",
                  )}
                  {(() => {
                    const suffix = addonPriceCycleSuffix(addon, billingCycle);
                    if (!suffix || suffix === "one-time") {
                      return suffix === "one-time" ? (
                        <span className="ml-1 text-sm font-medium text-zinc-500">one-time</span>
                      ) : null;
                    }
                    return <span className="ml-1 text-sm font-medium text-zinc-500">{suffix}</span>;
                  })()}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
