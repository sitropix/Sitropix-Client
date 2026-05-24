import type { ReactNode } from "react";

export interface SxMetricCardProps {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  progress?: number; // 0..1
  className?: string;
}

export function SxMetricCard({
  label,
  value,
  meta,
  progress,
  className = "",
}: SxMetricCardProps) {
  const pct =
    typeof progress === "number"
      ? Math.max(0, Math.min(1, progress)) * 100
      : null;
  return (
    <div
      className={[
        "rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4",
        className,
      ].join(" ")}
    >
      <div className="text-sx-xs font-medium text-[var(--text-tertiary)]">{label}</div>
      <div className="mt-2 font-display text-sx-2xl font-semibold leading-none text-[var(--text-primary)] [letter-spacing:var(--tracking-tight)]">
        {value}
      </div>
      {pct !== null ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-ink-100)]">
          <span
            className="block h-full rounded-full bg-[var(--color-brand-500)] transition-all duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)]"
            style={{ width: `${pct}%` }}
            aria-hidden
          />
        </div>
      ) : null}
      {meta ? (
        <div className="mt-2 flex items-center gap-2 text-sx-xs text-[var(--text-tertiary)]">
          {meta}
        </div>
      ) : null}
    </div>
  );
}
