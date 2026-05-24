import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { PricingCard } from "@/components/subscription/PricingCard";
import { SxPageHeader } from "@/components/sx/PageHeader";
import { SxSegmentedControl } from "@/components/sx/SegmentedControl";
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

  useEffect(() => {
    document.title = "Plans · Sitropix";
  }, []);

  return (
    <div data-sx-root className="flex flex-col gap-6 text-[var(--text-primary)]">
      <SxPageHeader
        title="Plans &amp; add-ons"
        description={
          <>
            Reference pricing. To subscribe or change plans for a specific project, open that project and choose a plan from its checkout.
          </>
        }
        actions={
          showBillingToggle && (anyMonthly || anyYearly) ? (
            <SxSegmentedControl<BillingCycle>
              ariaLabel="Billing cycle"
              options={[
                ...(anyMonthly
                  ? ([{ value: "monthly", label: "Monthly" }] as const)
                  : []),
                ...(anyYearly
                  ? ([{ value: "yearly", label: "Yearly" }] as const)
                  : []),
              ]}
              value={billingCycle}
              onChange={(v) => setBillingCycle(v)}
            />
          ) : null
        }
      />

      {!showBillingToggle ? (
        <p className="text-sx-xs text-[var(--text-tertiary)]">
          All listed plans are one-time purchases.
        </p>
      ) : null}

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
        <section className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
          <div className="mb-4 flex flex-col gap-1 border-b border-[var(--border-subtle)] pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Plans</h2>
              <p className="mt-0.5 text-sx-sm font-medium text-[var(--text-primary)]">Tiers and included capabilities</p>
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
        <section className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
          <div className="mb-3 flex flex-col gap-1 border-b border-[var(--border-subtle)] pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Add-ons</h2>
              <p className="mt-0.5 text-sx-sm font-medium text-[var(--text-primary)]">Optional extras at project checkout</p>
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
