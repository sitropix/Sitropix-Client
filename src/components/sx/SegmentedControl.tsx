import type { ReactNode } from "react";

export interface SxSegmentOption<V extends string> {
  value: V;
  label: ReactNode;
  count?: number;
  icon?: ReactNode;
}

export interface SxSegmentedControlProps<V extends string> {
  options: ReadonlyArray<SxSegmentOption<V>>;
  value: V;
  onChange: (next: V) => void;
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function SxSegmentedControl<V extends string>({
  options,
  value,
  onChange,
  size = "md",
  fullWidth,
  className = "",
  ariaLabel,
}: SxSegmentedControlProps<V>) {
  const heightClass = size === "sm" ? "h-8" : "h-10";
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={[
        "inline-flex items-center gap-1 rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-1",
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={[
              "inline-flex items-center justify-center gap-2 rounded-sx-sm px-3",
              heightClass,
              "font-ui text-sx-sm font-semibold whitespace-nowrap",
              "transition-colors duration-[150ms] ease-[cubic-bezier(0.2,0,0,1)]",
              "outline-none focus-visible:shadow-sx-focus",
              fullWidth ? "flex-1" : "",
              active
                ? "bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sx-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            ].join(" ")}
          >
            {opt.icon ? <span aria-hidden>{opt.icon}</span> : null}
            <span>{opt.label}</span>
            {typeof opt.count === "number" ? (
              <span
                className={[
                  "ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-sx-2xs font-mono",
                  active
                    ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
                    : "bg-[var(--color-ink-100)] text-[var(--text-tertiary)]",
                ].join(" ")}
              >
                {opt.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
