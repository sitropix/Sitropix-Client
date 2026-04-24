import { useMemo, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
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

  const currentPlanId = data?.subscription?.planId;
  const subStatus = data?.subscription?.status;
  const controls = subStatus ? subscriptionControlFlags(subStatus) : null;
  const fc = data?.featureControls ?? { pauseResume: true, selfCancel: true };

  const visiblePlans = useMemo(() => data?.plans ?? [], [data?.plans]);

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
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Subscription" }]} />
      <header>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Subscription Management</h1>
        <p className="mt-2 text-sm text-ink-muted">Upgrade, downgrade, pause, resume, or cancel with transparent billing.</p>
      </header>

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

      <section className="grid gap-4 lg:grid-cols-3">
        {visiblePlans.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            cycle={billingCycle}
            isCurrent={currentPlanId === plan.id}
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
