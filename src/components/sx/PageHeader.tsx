import type { ReactNode } from "react";

export interface SxPageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  display?: boolean; // Use display font (Bricolage)
}

export function SxPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = "",
  display = true,
}: SxPageHeaderProps) {
  return (
    <header
      className={[
        "flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-5",
        className,
      ].join(" ")}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            {eyebrow}
          </div>
        ) : null}
        <h1
          className={[
            display ? "font-display font-medium" : "font-ui font-semibold",
            "text-sx-2xl leading-tight text-[var(--text-primary)] [letter-spacing:var(--tracking-tight)]",
          ].join(" ")}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sx-sm leading-relaxed text-[var(--text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
