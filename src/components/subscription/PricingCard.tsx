import type { BillingCycle, Plan } from "@/types/subscription";

interface PricingCardProps {
  plan: Plan;
  cycle: BillingCycle;
  isCurrent?: boolean;
  loading?: boolean;
  onSelect: (planId: string) => void;
}

export function PricingCard({ plan, cycle, isCurrent = false, loading = false, onSelect }: PricingCardProps) {
  const priceCents = cycle === "yearly" ? plan.priceYearlyCents : plan.priceMonthlyCents;

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-glass">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-lime">{plan.name}</p>
      <h3 className="mt-2 text-2xl font-bold text-white">${(priceCents / 100).toFixed(2)}</h3>
      <p className="mt-1 text-xs text-ink-subtle">per {cycle === "yearly" ? "year" : "month"}</p>
      <p className="mt-3 text-sm text-ink-muted">{plan.description}</p>
      <ul className="mt-4 space-y-2 text-sm text-ink-muted">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-lime" />
            {feature}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onSelect(plan.id)}
        disabled={isCurrent || loading}
        className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas shadow-glow transition hover:bg-brand-lime-dim disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCurrent ? "Current plan" : loading ? "Applying..." : "Choose plan"}
      </button>
    </article>
  );
}
