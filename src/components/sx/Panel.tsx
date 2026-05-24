import type { ReactNode } from "react";

export interface SxPanelProps {
  title?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  padded?: boolean;
}

export function SxPanel({
  title,
  action,
  footer,
  children,
  className = "",
  bodyClassName = "",
  padded = true,
}: SxPanelProps) {
  return (
    <section
      className={[
        "overflow-hidden rounded-sx-lg border bg-[var(--surface-card)]",
        "border-[var(--border-subtle)]",
        className,
      ].join(" ")}
    >
      {title || action ? (
        <header className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4">
          {title ? (
            <h3 className="m-0 font-ui text-sx-md font-semibold text-[var(--text-primary)]">
              {title}
            </h3>
          ) : (
            <span />
          )}
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className={[padded ? "p-5" : "", bodyClassName].join(" ")}>{children}</div>
      {footer ? (
        <footer className="border-t border-[var(--border-subtle)] px-5 py-3 text-sx-xs text-[var(--text-tertiary)]">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
