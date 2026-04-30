import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { PricingCard } from "@/components/subscription/PricingCard";
import { bootstrapSubscription, changePlan, createCheckoutSession } from "@/services/subscriptionsApi";
import type { BillingCycle } from "@/types/subscription";
import { useSubscriptionPortal } from "@/hooks/useSubscriptionPortal";

export function SubscriptionPage() {
  const { data, loading, error, refresh } = useSubscriptionPortal();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
    if (currentTier == null) return "Choose plan";
    const t = tierPrice(plan, billingCycle);
    if (t > currentTier) return "Upgrade";
    if (t < currentTier) return "Downgrade";
    return "Choose plan";
  }

  async function handleChoosePlan(planId: string) {
    setBusy(true);
    setNotice(null);
    try {
      if (!data?.subscription) {
        try {
          const { url } = await createCheckoutSession(planId, billingCycle);
          if (url) {
            window.location.assign(url);
            return;
          }
        } catch (checkoutErr) {
          try {
            await bootstrapSubscription(planId, billingCycle);
            setNotice("Trial started (local dev: set Stripe price IDs and keys for real checkout).");
            await refresh();
            return;
          } catch {
            setNotice(
              checkoutErr instanceof Error
                ? checkoutErr.message
                : "Could not start checkout. Configure STRIPE_SECRET_KEY and plan Stripe price IDs, or set ALLOW_DEV_TRIAL=true for a dev trial.",
            );
            return;
          }
        }
        await refresh();
        return;
      }
      const result = await changePlan(planId, billingCycle);
      const delta = result.proration.netCents / 100;
      setNotice(
        delta >= 0
          ? `Plan changed. Proration charge: $${delta.toFixed(2)}.`
          : `Plan changed. Credit: $${Math.abs(delta).toFixed(2)}.`,
      );
      await refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to change plan");
    } finally {
      setBusy(false);
    }
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
      {notice && <p className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-700">{notice}</p>}

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
                loading={busy}
                primaryActionLabel={actionLabelFor(plan)}
                onSelect={handleChoosePlan}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
