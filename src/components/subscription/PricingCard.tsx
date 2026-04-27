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
          ? "border-brand-lime/45 bg-gradient-to-b from-brand-lime/[0.12] via-[#0f1419] to-[#0b0f14] ring-1 ring-brand-lime/25"
          : "border-white/10 bg-[#0c1016]/90 ring-1 ring-white/[0.04] hover:border-white/15 hover:ring-white/10",
      ].join(" ")}
    >
      {isCurrent ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-lime/70 to-transparent"
          aria-hidden
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-lime">{plan.name}</p>
        {isCurrent ? (
          <span className="rounded-full border border-brand-lime/40 bg-brand-lime/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-lime">
            Current plan
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-white">${(priceCents / 100).toFixed(2)}</span>
        <span className="text-sm font-medium text-ink-muted">/{cycle === "yearly" ? "yr" : "mo"}</span>
      </div>
      <p className="mt-1 text-xs text-ink-subtle">Billed {cycle === "yearly" ? "annually" : "each month"}</p>

      {plan.description ? <p className="mt-3 text-sm leading-relaxed text-ink-muted">{plan.description}</p> : null}

      <div className="mt-5 flex-1 rounded-xl border border-white/[0.06] bg-black/25 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">Includes</p>
        <ul className="mt-3 space-y-2.5 text-sm text-ink-muted">
          {plan.features.map((feature) => (
            <li key={feature} className="flex gap-2.5">
              <span
                className={[
                  "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  isCurrent ? "bg-brand-lime shadow-[0_0_8px_rgba(132,204,22,0.5)]" : "bg-brand-lime/80",
                ].join(" ")}
              />
              <span className="leading-snug">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {isCurrent ? (
        <div
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-brand-lime/40 bg-brand-lime/15 px-5 py-2.5 text-sm font-semibold text-brand-lime"
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
              ? "border border-white/20 bg-white/[0.04] text-white hover:border-white/35 hover:bg-white/[0.07] disabled:opacity-50"
              : "bg-brand-lime text-canvas shadow-glow hover:bg-brand-lime-dim disabled:opacity-50",
          ].join(" ")}
        >
          {loading ? "Applying…" : primaryActionLabel}
        </button>
      )}
    </article>
  );
}
