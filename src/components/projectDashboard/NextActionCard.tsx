import type { ProjectNextAction } from "@/types/projectWorkflow";

export function NextActionCard(props: { nextAction: ProjectNextAction | null | undefined }) {
  const a = props.nextAction;
  if (!a) return null;
  const isWait = a.kind === "wait" || a.kind === "live";
  const accent = isWait
    ? "border-[var(--border-subtle)] bg-[var(--surface-sunken)]"
    : "border-[var(--color-brand-500)]/40 bg-[var(--color-brand-50)]";
  return (
    <section
      className={`flex flex-col gap-3 rounded-sx-lg border-2 p-5 sm:flex-row sm:items-center sm:justify-between ${accent}`}
      aria-label="Next action"
    >
      <div className="min-w-0">
        <p className="font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">Next action</p>
        <h2 className="mt-1 font-display text-sx-lg font-semibold text-[var(--text-primary)]">{a.title}</h2>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">{a.body}</p>
      </div>
      {a.cta && a.href ? (
        <a
          href={a.href}
          {...(a.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="inline-flex h-[44px] shrink-0 items-center justify-center rounded-sx-md bg-[var(--color-brand-500)] px-6 font-ui text-sx-sm font-semibold text-white hover:bg-[var(--color-brand-600)]"
        >
          {a.cta} →
        </a>
      ) : null}
    </section>
  );
}
