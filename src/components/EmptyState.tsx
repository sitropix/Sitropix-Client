import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
  icon?: ReactNode;
  tone?: "portal" | "dark";
}

/**
 * Legacy EmptyState — now styled with the brand v1 token system.
 * New code should prefer SxEmptyState (which has more flexible action prop).
 */
export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-sx-lg border border-dashed border-[var(--border-default)] bg-[var(--surface-card)] px-6 py-10 text-center">
      {icon ? (
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-tertiary)]">
          {icon}
        </div>
      ) : null}
      <h3 className="font-ui text-sx-md font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sx-sm leading-relaxed text-[var(--text-secondary)]">
        {description}
      </p>
      {action ? (
        <div className="mt-5">
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex h-[38px] items-center justify-center rounded-sx-md bg-[var(--color-brand-500)] px-4 font-ui text-sx-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-600)]"
            >
              {action.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex h-[38px] items-center justify-center rounded-sx-md bg-[var(--color-brand-500)] px-4 font-ui text-sx-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-600)]"
            >
              {action.label}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
