import type { ReactNode } from "react";

export interface SxEmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function SxEmptyState({
  title,
  description,
  action,
  icon,
  className = "",
}: SxEmptyStateProps) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center rounded-sx-lg border border-dashed",
        "border-[var(--border-default)] bg-[var(--surface-card)] px-6 py-10 text-center",
        className,
      ].join(" ")}
    >
      {icon ? (
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-tertiary)]">
          {icon}
        </div>
      ) : null}
      <h3 className="font-ui text-sx-md font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-md text-sx-sm leading-relaxed text-[var(--text-secondary)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
