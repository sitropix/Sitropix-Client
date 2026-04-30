import type { BillingCycle, Plan } from "@/types/subscription";

interface PricingCardProps {
  plan: Plan;
  cycle: BillingCycle;
  isCurrent?: boolean;
  loading?: boolean;
  primaryActionLabel?: string;
  onSelect: (planId: string) => void;
}

function FeatureCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 011.414-1.414L8.5 11.086l6.543-6.543a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function PricingCard({
  plan,
  cycle,
  isCurrent = false,
  loading = false,
  primaryActionLabel = "Choose plan",
  onSelect,
}: PricingCardProps) {
  const priceCents = cycle === "yearly" ? plan.priceYearlyCents : plan.priceMonthlyCents;
  const isDowngrade = primaryActionLabel === "Downgrade";

  return (
    <article
      className={[
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 shadow-glass transition duration-300",
        isCurrent
          ? "border-sky-300/90 bg-gradient-to-b from-white via-sky-50/40 to-white ring-2 ring-sky-400/35"
          : "border-zinc-200/90 bg-white ring-1 ring-zinc-100 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-[0_20px_40px_-12px_rgba(39,42,53,0.18)] hover:ring-zinc-200/80",
      ].join(" ")}
    >
      {isCurrent ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-500/70 to-transparent"
          aria-hidden
        />
      ) : (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-300/80 to-transparent opacity-0 transition group-hover:opacity-100"
          aria-hidden
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-800">{plan.name}</p>
        {isCurrent ? (
          <span className="rounded-full border border-sky-300/80 bg-sky-100/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900 shadow-sm ring-1 ring-sky-200/60">
            Current plan
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-zinc-900">${(priceCents / 100).toFixed(2)}</span>
        <span className="text-sm font-medium text-zinc-600">/{cycle === "yearly" ? "yr" : "mo"}</span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">Billed {cycle === "yearly" ? "annually" : "each month"}</p>

      {plan.description ? <p className="mt-3 text-sm leading-relaxed text-zinc-700">{plan.description}</p> : null}

      <div
        className={[
          "mt-5 flex-1 rounded-xl border p-4",
          isCurrent
            ? "border-sky-200/70 bg-white/80 backdrop-blur-[2px]"
            : "border-zinc-200/90 bg-zinc-50/90 group-hover:bg-zinc-50",
        ].join(" ")}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Includes</p>
        <ul className="mt-3 space-y-2.5 text-sm text-zinc-800">
          {plan.features.map((feature) => (
            <li key={feature} className="flex gap-2.5">
              <span
                className={[
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  isCurrent ? "bg-sky-100 text-sky-700" : "bg-zinc-200/90 text-zinc-600 group-hover:bg-zinc-200",
                ].join(" ")}
              >
                <FeatureCheckIcon className="h-3 w-3" />
              </span>
              <span className="leading-snug">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {isCurrent ? (
        <div
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/70 bg-emerald-50/90 px-5 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm ring-1 ring-emerald-200/70"
          role="status"
        >
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]" aria-hidden />
          Active on this plan
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(plan.id)}
          disabled={loading}
          className={[
            "mt-6 inline-flex w-full min-h-[44px] items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition",
            isDowngrade
              ? "border border-dashed border-zinc-300 bg-white text-zinc-700 shadow-sm hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50"
              : "bg-zinc-900 text-white shadow-md hover:bg-zinc-800 hover:shadow-lg disabled:opacity-50",
          ].join(" ")}
        >
          {loading ? "Applying…" : primaryActionLabel}
        </button>
      )}
    </article>
  );
}
