import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { PricingCard } from "@/components/subscription/PricingCard";
import {
  bootstrapSubscription,
  cancelSubscription,
  changePlan,
  createBillingPortalSession,
  createCheckoutSession,
  pauseSubscription,
  resumeSubscription,
} from "@/services/subscriptionsApi";
import { ApiRequestError } from "@/services/http";
import type { BillingCycle, SubscriptionStatus } from "@/types/subscription";
import { useSubscriptionPortal } from "@/hooks/useSubscriptionPortal";

function subscriptionControlFlags(status: SubscriptionStatus) {
  const canPause = status === "active" || status === "trialing" || status === "past_due";
  const canResume = status === "paused";
  const canCancel = canPause || canResume;
  return { canPause, canResume, canCancel };
}

export function SubscriptionPage() {
  const { data, loading, error, refresh } = useSubscriptionPortal();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const subStatus = data?.subscription?.status;
  const controls = subStatus ? subscriptionControlFlags(subStatus) : null;
  const fc = data?.featureControls ?? { pauseResume: true, selfCancel: true };
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

  async function openBillingPortal() {
    setBusy(true);
    setNotice(null);
    try {
      const { url } = await createBillingPortalSession();
      if (url) window.location.assign(url);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to open billing portal");
    } finally {
      setBusy(false);
    }
  }

  async function handleState(action: "pause" | "resume" | "cancel") {
    setBusy(true);
    setNotice(null);
    try {
      if (action === "pause") await pauseSubscription();
      if (action === "resume") await resumeSubscription();
      if (action === "cancel") await cancelSubscription();
      await refresh();
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
    <div className="space-y-8 opacity-0 animate-fade-up [animation-fill-mode:forwards] text-zinc-900">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Subscriptions" }]} />

      <header className="flex flex-col gap-5 border-b border-zinc-300 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">Plans and billing</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Subscriptions</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
            Upgrade, downgrade, pause, resume, or cancel with transparent billing.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-zinc-300 bg-white p-1.5 shadow-sm">
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Billing cycle</p>
          <div className="inline-flex rounded-lg border border-zinc-300 bg-zinc-100 p-0.5">
            {(["monthly", "yearly"] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={`rounded-md px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                  billingCycle === cycle
                    ? "bg-zinc-700 text-white shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900"
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
        <section>
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Compare plans</h2>
            <p className="text-xs text-zinc-600">Prices shown for your selected billing cycle.</p>
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

      {data?.subscription && (
        <section className="relative overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-glass">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-500/60 to-transparent" />
          <div className="border-b border-zinc-300 bg-zinc-100 px-5 py-4 sm:px-6">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Subscription controls</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-600">
              Update payment method, view invoices, and manage renewal in the Stripe customer portal.
            </p>
            {(!fc.pauseResume || !fc.selfCancel) && (
              <p className="mt-3 text-xs text-zinc-500">
                Some self-service actions are controlled by your workspace administrator.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 p-5 sm:gap-3 sm:p-6">
            <button
              type="button"
              onClick={() => void openBillingPortal()}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-200 disabled:opacity-50"
            >
              Manage billing in Stripe
            </button>
            {fc.pauseResume && (
              <>
                <button
                  type="button"
                  onClick={() => void handleState("pause")}
                  disabled={busy || !controls?.canPause}
                  title={!controls?.canPause ? "Pause is only available while the subscription is active." : undefined}
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={() => void handleState("resume")}
                  disabled={busy || !controls?.canResume}
                  title={!controls?.canResume ? "Resume is only available when billing is paused." : undefined}
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Resume
                </button>
              </>
            )}
            {fc.selfCancel && (
              <button
                type="button"
                onClick={() => void handleState("cancel")}
                disabled={busy || !controls?.canCancel}
                title={!controls?.canCancel ? "Nothing to cancel." : undefined}
                className="inline-flex items-center justify-center rounded-xl border border-rose-300 bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel subscription
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
