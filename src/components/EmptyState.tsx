import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      {icon && <div className="mb-4 text-brand-lime/90">{icon}</div>}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-ink-muted">{description}</p>
      {action && (
        <div className="mt-6">
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center justify-center rounded-full bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas shadow-glow transition hover:scale-[1.02] hover:bg-brand-lime-dim active:scale-[0.99]"
            >
              {action.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center rounded-full bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas shadow-glow transition hover:scale-[1.02] hover:bg-brand-lime-dim active:scale-[0.99]"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
