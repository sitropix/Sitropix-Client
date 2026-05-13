import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { PricingCard } from "@/components/subscription/PricingCard";
import type { BillingCycle, SubscriptionAddon } from "@/types/subscription";
import { useSubscriptionPortal } from "@/hooks/useSubscriptionPortal";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

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

  useEffect(() => {
    if (!anyMonthly && anyYearly) setBillingCycle("yearly");
    else if (anyMonthly && !anyYearly) setBillingCycle("monthly");
  }, [anyMonthly, anyYearly]);

  return (
    <div className="space-y-6 text-zinc-900 opacity-0 animate-fade-up [animation-fill-mode:forwards] lg:space-y-7">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Plan catalog" }]} />

      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative min-w-0 overflow-hidden rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-white via-zinc-50/80 to-zinc-100/50 px-5 py-5 shadow-sm sm:flex-1 sm:px-7 sm:py-6">
          <div aria-hidden className="pointer-events-none absolute -right-10 top-0 h-32 w-32 rounded-full bg-brand-lime/[0.07] blur-3xl" />
          <div className="relative">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Plan &amp; add-on catalog</p>
            <h1 className="mt-1.5 text-balance text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Compare plans and add-ons
            </h1>
            <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-zinc-600">
              This area is a reference catalog only — it does not reflect which project is currently billed. To subscribe
              or change a plan, open a project, complete intake, and use that project&apos;s checkout or Payment Management
              for billing changes.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-zinc-600 sm:text-sm">
              <li>Each project can have its own active plan and renewal date.</li>
              <li>Add-ons are selected during project checkout or managed from the project workspace.</li>
            </ul>
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
              <h2 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Plans</h2>
              <p className="mt-1 text-sm font-medium text-zinc-800">Tiers and included capabilities</p>
            </div>
            <p className="text-xs text-zinc-600">
              {showBillingToggle
                ? "Prices reflect your selected billing cycle above."
                : "One-time plans show the purchase price from the monthly price field."}
            </p>
          </div>
          <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
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
        <section className="rounded-2xl border border-zinc-200/90 bg-white/40 p-4 shadow-sm ring-1 ring-zinc-100/80 sm:p-6">
          <div className="mb-4 border-b border-zinc-200/80 pb-4">
            <h2 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Add-ons</h2>
            <p className="mt-1 text-sm font-medium text-zinc-800">Optional extras you can add at checkout</p>
            <p className="mt-1 text-xs text-zinc-600">
              Add-ons are attached per subscription when you pay for a project. Your admin team can also adjust entitlements
              where applicable.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {addons.map((addon: SubscriptionAddon) => (
              <article
                key={addon.code}
                className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ring-1 ring-zinc-100/80"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{addon.code}</p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-900">{addon.label}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">{addon.desc}</p>
                <p className="mt-3 text-lg font-bold text-zinc-900">{money(addon.priceCents, addon.currency || "USD")}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
