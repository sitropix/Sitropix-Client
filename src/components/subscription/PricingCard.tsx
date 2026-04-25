import type { BillingCycle, Plan } from "@/types/subscription";

export type PlanSelectIntent = "current" | "upgrade" | "downgrade" | "choose";

interface PricingCardProps {
  plan: Plan;
  cycle: BillingCycle;
  intent?: PlanSelectIntent;
  loading?: boolean;
  onSelect: (planId: string) => void;
}

function intentLabel(intent: PlanSelectIntent, loading: boolean) {
  if (loading) return "Applying…";
  switch (intent) {
    case "current":
      return "Active";
    case "upgrade":
      return "Upgrade";
    case "downgrade":
      return "Downgrade";
    default:
      return "Choose plan";
  }
}

export function PricingCard({ plan, cycle, intent = "choose", loading = false, onSelect }: PricingCardProps) {
  const priceCents = cycle === "yearly" ? plan.priceYearlyCents : plan.priceMonthlyCents;
  const isCurrent = intent === "current";

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-glass">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-lime">{plan.name}</p>
        {isCurrent ? (
          <span className="rounded-full border border-brand-lime/35 bg-brand-lime/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-lime">
            Current plan
          </span>
        ) : null}
      </div>
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
        {intentLabel(intent, loading)}
      </button>
    </article>
  );
}
