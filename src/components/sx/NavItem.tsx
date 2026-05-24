import { NavLink, type NavLinkProps } from "react-router-dom";
import type { ReactNode } from "react";

export interface SxNavItemProps extends Omit<NavLinkProps, "children"> {
  icon?: ReactNode;
  label: ReactNode;
  badge?: ReactNode;
  compact?: boolean;
  locked?: boolean;
  lockedHint?: string;
}

export function SxNavItem({
  icon,
  label,
  badge,
  compact = false,
  locked = false,
  lockedHint,
  className = "",
  ...rest
}: SxNavItemProps) {
  if (locked) {
    return (
      <button
        type="button"
        disabled
        aria-disabled
        title={lockedHint}
        className={[
          "group flex w-full cursor-not-allowed items-center gap-3 rounded-sx-md px-3 text-left font-ui font-medium",
          compact ? "py-1.5 text-sx-xs" : "py-2 text-sx-sm",
          "text-[var(--text-tertiary)] opacity-70",
        ].join(" ")}
      >
        {icon ? <span className="inline-flex h-5 w-5 items-center justify-center">{icon}</span> : null}
        <span className="truncate">{label}</span>
        <span className="ml-auto text-sx-xs" aria-hidden>
          🔒
        </span>
      </button>
    );
  }

  return (
    <NavLink
      {...rest}
      className={({ isActive }) =>
        [
          "group flex items-center gap-3 rounded-sx-md px-3 font-ui font-medium",
          compact ? "py-1.5 text-sx-xs" : "py-2 text-sx-sm",
          "transition-colors duration-[150ms] ease-[cubic-bezier(0.2,0,0,1)]",
          "outline-none focus-visible:shadow-sx-focus",
          isActive
            ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)] font-semibold"
            : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]",
          typeof className === "function" ? className({ isActive, isPending: false, isTransitioning: false }) : className,
        ].join(" ")
      }
    >
      {icon ? (
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="truncate">{label}</span>
      {badge ? <span className="ml-auto">{badge}</span> : null}
    </NavLink>
  );
}
