import type { ReactNode } from "react";

type Variant =
  | "open"
  | "progress"
  | "review"
  | "resolved"
  | "closed"
  | "urgent"
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "neutral"
  | "brand";

export interface SxBadgeProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
  withDot?: boolean;
}

const variants: Record<Variant, string> = {
  open: "bg-[var(--color-info-bg)] text-[var(--color-info-fg)]",
  progress: "bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)]",
  review: "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]",
  resolved: "bg-[var(--color-success-bg)] text-[var(--color-success-fg)]",
  closed: "bg-[var(--color-closed-bg)] text-[var(--color-ink-600)]",
  urgent: "bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)]",
  success: "bg-[var(--color-success-bg)] text-[var(--color-success-fg)]",
  info: "bg-[var(--color-info-bg)] text-[var(--color-info-fg)]",
  warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)]",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)]",
  neutral: "bg-[var(--color-ink-50)] text-[var(--color-ink-700)]",
  brand: "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]",
};

export function SxBadge({
  variant = "neutral",
  children,
  className = "",
  withDot = true,
}: SxBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-sx-xl px-3 py-1 font-ui text-sx-xs font-semibold",
        "rounded-full",
        variants[variant],
        className,
      ].join(" ")}
    >
      {withDot ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}
