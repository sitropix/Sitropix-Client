import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { PricingCard, type PlanSelectIntent } from "@/components/subscription/PricingCard";
import { SubscriptionStatusBadge } from "@/components/subscription/SubscriptionStatusBadge";
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

export function SubscriptionPage() {
  const { data, loading, error, refresh } = useSubscriptionPortal();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const subStatus = data?.subscription?.status;
  const controls = subStatus ? subscriptionControlFlags(subStatus) : null;
  const fc = data?.featureControls ?? { pauseResume: true, selfCancel: true };

  const visiblePlans = useMemo(() => data?.plans ?? [], [data?.plans]);

  const planIntent = useMemo(() => {
    const currentId = data?.subscription?.planId;
    const current = visiblePlans.find((p) => p.id === currentId);
    const currentCents =
      current != null ? (billingCycle === "yearly" ? current.priceYearlyCents : current.priceMonthlyCents) : null;
    const map = new Map<string, PlanSelectIntent>();
    for (const plan of visiblePlans) {
      if (plan.id === currentId) {
        map.set(plan.id, "current");
        continue;
      }
      if (currentCents == null) {
        map.set(plan.id, "choose");
        continue;
      }
      const cents = billingCycle === "yearly" ? plan.priceYearlyCents : plan.priceMonthlyCents;
      if (cents > currentCents) map.set(plan.id, "upgrade");
      else if (cents < currentCents) map.set(plan.id, "downgrade");
      else map.set(plan.id, "choose");
    }
    return map;
  }, [visiblePlans, data?.subscription?.planId, billingCycle]);

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
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Subscription" }]} />
      <header>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Subscription</h1>
        <p className="mt-2 text-sm text-ink-muted">Upgrade, downgrade, pause, resume, or cancel with transparent billing.</p>
      </header>

      {!loading && data?.subscription && (
        <section className="rounded-2xl border border-white/10 bg-[#15191c] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-white">{data.subscription.plan?.name ?? "Your plan"}</h2>
              <span className="rounded-full border border-white/20 bg-white/[0.08] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Current plan
              </span>
              <SubscriptionStatusBadge status={data.subscription.status} />
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs uppercase tracking-wide text-ink-subtle">Next billing</p>
              <p className="text-base font-semibold text-white">
                {formatDate(data.subscription.nextBillingDate ?? data.subscription.currentPeriodEnd)}
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
        {(["monthly", "yearly"] as const).map((cycle) => (
          <button
            key={cycle}
            type="button"
            onClick={() => setBillingCycle(cycle)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${billingCycle === cycle ? "bg-brand-lime text-canvas" : "text-ink-muted hover:text-white"}`}
          >
            {cycle === "monthly" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>}
      {notice && <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/90">{notice}</p>}

      {!loading && visiblePlans.length === 0 && (
        <EmptyState title="No plans available" description="Plans are currently unavailable. Try again shortly." />
      )}

      {loading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        {!loading &&
          visiblePlans.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            cycle={billingCycle}
            intent={planIntent.get(plan.id) ?? "choose"}
            loading={busy}
            onSelect={handleChoosePlan}
          />
          ))}
      </section>

      {data?.subscription && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold text-white">Subscription controls</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Update payment method, view invoices, and manage renewal in the Stripe customer portal.
          </p>
          {(!fc.pauseResume || !fc.selfCancel) && (
            <p className="mt-3 text-xs text-ink-subtle">
              Some self-service actions are controlled by your workspace administrator.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void openBillingPortal()}
              disabled={busy}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
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
                  className="rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:border-brand-lime/35 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={() => void handleState("resume")}
                  disabled={busy || !controls?.canResume}
                  title={!controls?.canResume ? "Resume is only available when billing is paused." : undefined}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:border-brand-lime/35 disabled:cursor-not-allowed disabled:opacity-40"
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
                className="rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
