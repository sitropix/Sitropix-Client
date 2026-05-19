import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
  icon?: ReactNode;
  tone?: "portal" | "dark";
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  tone = "portal",
}: EmptyStateProps) {
  const shell =
    tone === "portal"
      ? "portal-empty-state flex flex-col items-center justify-center rounded-lg border ink-border-8 bg-surface-container-low px-6 py-16 text-center soft-shadow-xl"
      : "flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center";

  const titleClass =
    tone === "portal"
      ? "font-body text-body-lg font-semibold text-on-surface"
      : "text-lg font-semibold text-white";

  const descClass =
    tone === "portal"
      ? "mt-2 max-w-md font-body-sm text-body-sm text-on-surface-variant"
      : "mt-2 max-w-md text-sm text-ink-muted";

  const actionClass =
    tone === "portal"
      ? "portal-btn-primary inline-flex items-center justify-center rounded-lg bg-accent-gold px-5 py-2.5 font-body font-semibold text-white transition-all hover:brightness-110 active:opacity-90"
      : "inline-flex items-center justify-center rounded-full bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas shadow-glow transition hover:scale-[1.02] hover:bg-brand-lime-dim active:scale-[0.99]";

  return (
    <div className={shell}>
      {icon ? (
        <div className={tone === "portal" ? "mb-4 text-accent-gold" : "mb-4 text-brand-lime/90"}>
          {icon}
        </div>
      ) : null}
      <h3 className={titleClass}>{title}</h3>
      <p className={descClass}>{description}</p>
      {action ? (
        <div className="mt-6">
          {action.href ? (
            <a href={action.href} className={actionClass}>
              {action.label}
            </a>
          ) : (
            <button type="button" onClick={action.onClick} className={actionClass}>
              {action.label}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
