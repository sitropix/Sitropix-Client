import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "cta";
type Size = "sm" | "md" | "lg";

export interface SxButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-ui font-semibold whitespace-nowrap " +
  "transition-colors duration-[150ms] ease-[cubic-bezier(0.2,0,0,1)] " +
  "outline-none focus-visible:shadow-sx-focus active:translate-y-px " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-brand-500)] text-white border border-transparent hover:bg-[var(--color-brand-600)]",
  secondary:
    "bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-default)] " +
    "hover:bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] border border-transparent " +
    "hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]",
  danger:
    "bg-[var(--color-danger-500)] text-white border border-transparent hover:bg-[#A8331F]",
  cta:
    "bg-[var(--color-accent-500)] text-white border border-transparent hover:bg-[var(--color-accent-600)] shadow-[0_1px_0_rgba(0,0,0,0.08)]",
};

const sizes: Record<Size, string> = {
  sm: "h-[30px] px-3 rounded-sx-md text-sx-xs",
  md: "h-[38px] px-4 rounded-sx-md text-sx-sm",
  lg: "h-[46px] px-6 rounded-sx-md text-sx-base",
};

export const SxButton = forwardRef<HTMLButtonElement, SxButtonProps>(function SxButton(
  {
    variant = "primary",
    size = "md",
    leftIcon,
    rightIcon,
    loading,
    fullWidth,
    className = "",
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  const classes = [
    base,
    variants[variant],
    sizes[size],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
          aria-hidden
        />
      ) : leftIcon ? (
        <span className="inline-flex shrink-0 items-center" aria-hidden>
          {leftIcon}
        </span>
      ) : null}
      {children}
      {!loading && rightIcon ? (
        <span className="inline-flex shrink-0 items-center" aria-hidden>
          {rightIcon}
        </span>
      ) : null}
    </button>
  );
});
