import type { ReactNode } from "react";
import { SxButton } from "./Button";

export interface SxPlanCardProps {
  name: string;
  price: ReactNode;
  cadence?: string; // "/ month"
  tagline?: ReactNode;
  features: ReadonlyArray<ReactNode>;
  ctaLabel: string;
  onCta: () => void;
  ctaVariant?: "primary" | "secondary" | "cta";
  featured?: boolean;
  badge?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function SxPlanCard({
  name,
  price,
  cadence = "/ month",
  tagline,
  features,
  ctaLabel,
  onCta,
  ctaVariant = "primary",
  featured = false,
  badge,
  disabled = false,
  loading = false,
  className = "",
}: SxPlanCardProps) {
  return (
    <div
      className={[
        "relative flex flex-col gap-4 rounded-sx-xl border bg-[var(--surface-card)] p-6",
        "transition-all duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)]",
        "hover:-translate-y-0.5 hover:shadow-sx-lg",
        featured
          ? "border-[var(--color-brand-500)] shadow-[0_0_0_1px_var(--color-brand-500)]"
          : "border-[var(--border-default)]",
        className,
      ].join(" ")}
    >
      {(featured || badge) ? (
        <span className="absolute -top-2.5 left-5 inline-flex items-center rounded-sx-sm bg-[var(--color-brand-500)] px-3 py-1 font-ui text-sx-2xs font-semibold uppercase tracking-[0.12em] text-white">
          {badge ?? "Most popular"}
        </span>
      ) : null}
      <div className="font-ui text-sx-md font-semibold text-[var(--text-brand)]">
        {name}
      </div>
      <div className="font-display text-sx-3xl font-semibold leading-none text-[var(--text-primary)] [letter-spacing:var(--tracking-tight)]">
        {price}
        {cadence ? (
          <small className="ml-1 font-ui text-sx-sm font-normal text-[var(--text-tertiary)]">
            {cadence}
          </small>
        ) : null}
      </div>
      {tagline ? (
        <p className="text-sx-sm leading-relaxed text-[var(--text-secondary)]">{tagline}</p>
      ) : null}
      <ul className="flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-4 text-sx-sm text-[var(--text-secondary)]">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success-fg)] text-[11px] font-bold"
              aria-hidden
            >
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-2">
        <SxButton
          variant={ctaVariant}
          fullWidth
          onClick={onCta}
          disabled={disabled}
          loading={loading}
        >
          {ctaLabel}
        </SxButton>
      </div>
    </div>
  );
}
