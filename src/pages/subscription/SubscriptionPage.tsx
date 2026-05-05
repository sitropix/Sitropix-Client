import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { PricingCard } from "@/components/subscription/PricingCard";
import type { BillingCycle } from "@/types/subscription";
import { useSubscriptionPortal } from "@/hooks/useSubscriptionPortal";

export function SubscriptionPage() {
  const { data, loading, error } = useSubscriptionPortal();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const currentPlanId = data?.subscription?.planId ?? null;

  const visiblePlans = useMemo(() => data?.plans ?? [], [data?.plans]);

  const currentPlan = useMemo(
    () => visiblePlans.find((p) => p.id === currentPlanId) ?? null,
    [visiblePlans, currentPlanId],
  );

  function tierPrice(plan: (typeof visiblePlans)[0], cycle: typeof billingCycle) {
    return cycle === "yearly" ? plan.priceYearlyCents : plan.priceMonthlyCents;
  }

  const currentTier = currentPlan ? tierPrice(currentPlan, billingCycle) : null;

  function actionLabelFor(plan: (typeof visiblePlans)[0]): string {
    if (currentPlanId === plan.id) return "Active";
    if (currentTier == null) return "Available";
    const t = tierPrice(plan, billingCycle);
    if (t > currentTier) return "Higher tier";
    if (t < currentTier) return "Lower tier";
    return "Available";
  }

  return (
    <div className="space-y-6 text-zinc-900 opacity-0 animate-fade-up [animation-fill-mode:forwards] lg:space-y-7">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Plans & Addon" }]} />

      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative min-w-0 overflow-hidden rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-white via-zinc-50/80 to-zinc-100/50 px-5 py-5 shadow-sm sm:flex-1 sm:px-7 sm:py-6">
          <div aria-hidden className="pointer-events-none absolute -right-10 top-0 h-32 w-32 rounded-full bg-brand-lime/[0.07] blur-3xl" />
          <div className="relative">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Plans &amp; addon</p>
            <h1 className="mt-1.5 text-balance text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Plans &amp; Addon</h1>
            <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-zinc-600">
              Compare tiers side by side and change plans—proration appears before you confirm the switch.
            </p>
          </div>
        </div>
        <div
          className="shrink-0 rounded-2xl border border-zinc-200 bg-white/90 p-2 shadow-sm ring-1 ring-zinc-100"
          role="group"
          aria-label="Billing cycle"
        >
          <p className="px-2 pb-2 pt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Billing cycle</p>
          <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100/80 p-0.5">
            {(["monthly", "yearly"] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 sm:min-w-[5.5rem] sm:text-sm ${
                  billingCycle === cycle ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {cycle === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && <p className="rounded-xl border border-rose-400/40 bg-rose-100 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {!loading && visiblePlans.length === 0 && (
        <EmptyState title="No plans available" description="Plans are currently unavailable. Try again shortly." />
      )}

      {loading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          <Skeleton className="h-[420px] w-full rounded-2xl" />
          <Skeleton className="h-[420px] w-full rounded-2xl" />
          <Skeleton className="h-[420px] w-full rounded-2xl" />
        </div>
      )}

      {!loading && visiblePlans.length > 0 && (
        <section className="rounded-2xl border border-zinc-200/90 bg-white/40 p-4 shadow-sm ring-1 ring-zinc-100/80 sm:p-6">
          <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
            This page is catalog-only. Purchase, cancel, recurring controls, and payment actions are available in Payment Management.
          </div>
          <div className="mb-5 flex flex-col gap-2 border-b border-zinc-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Compare plans</h2>
              <p className="mt-1 text-sm font-medium text-zinc-800">Pick the tier that fits your team</p>
            </div>
            <p className="text-xs text-zinc-600">Prices reflect your selected billing cycle above.</p>
          </div>
          <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {visiblePlans.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                cycle={billingCycle}
                isCurrent={currentPlanId === plan.id}
                loading={false}
                primaryActionLabel={actionLabelFor(plan)}
                onSelect={() => {}}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
