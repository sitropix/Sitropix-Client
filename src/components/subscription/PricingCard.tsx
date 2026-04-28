import type { BillingCycle, Plan } from "@/types/subscription";

interface PricingCardProps {
  plan: Plan;
  cycle: BillingCycle;
  isCurrent?: boolean;
  loading?: boolean;
  primaryActionLabel?: string;
  onSelect: (planId: string) => void;
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
        "relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 shadow-glass transition",
        isCurrent
          ? "border-zinc-500 bg-gradient-to-b from-white to-zinc-100 ring-1 ring-zinc-300"
          : "border-zinc-300 bg-white ring-1 ring-zinc-200 hover:border-zinc-400 hover:ring-zinc-300",
      ].join(" ")}
    >
      {isCurrent ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-500 to-transparent"
          aria-hidden
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-700">{plan.name}</p>
        {isCurrent ? (
          <span className="rounded-full border border-zinc-400 bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-700">
            Current plan
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-zinc-900">${(priceCents / 100).toFixed(2)}</span>
        <span className="text-sm font-medium text-zinc-600">/{cycle === "yearly" ? "yr" : "mo"}</span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">Billed {cycle === "yearly" ? "annually" : "each month"}</p>

      {plan.description ? <p className="mt-3 text-sm leading-relaxed text-zinc-600">{plan.description}</p> : null}

      <div className="mt-5 flex-1 rounded-xl border border-zinc-300 bg-zinc-100 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Includes</p>
        <ul className="mt-3 space-y-2.5 text-sm text-zinc-700">
          {plan.features.map((feature) => (
            <li key={feature} className="flex gap-2.5">
              <span
                className={[
                  "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  isCurrent ? "bg-zinc-700" : "bg-zinc-500",
                ].join(" ")}
              />
              <span className="leading-snug">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {isCurrent ? (
        <div
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-zinc-400 bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-700"
          role="status"
        >
          Active
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(plan.id)}
          disabled={loading}
          className={[
            "mt-6 inline-flex w-full items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition",
            isDowngrade
              ? "border border-zinc-300 bg-zinc-100 text-zinc-800 hover:border-zinc-400 hover:bg-zinc-200 disabled:opacity-50"
              : "bg-zinc-700 text-white shadow-sm hover:bg-zinc-600 disabled:opacity-50",
          ].join(" ")}
        >
          {loading ? "Applying…" : primaryActionLabel}
        </button>
      )}
    </article>
  );
}
