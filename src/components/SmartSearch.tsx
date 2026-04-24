import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

export function SmartSearch({ compact = false }: { compact?: boolean }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) {
      navigate("/kb");
      return;
    }
    navigate(`/kb?q=${encodeURIComponent(query)}`);
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "w-full" : "mx-auto max-w-2xl"} role="search">
      <label htmlFor="support-search" className="sr-only">
        Search help articles
      </label>
      <div
        className={[
          "group flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 shadow-inner transition",
          "focus-within:border-brand-lime/45 focus-within:shadow-glow focus-within:ring-1 focus-within:ring-brand-lime/30",
          compact ? "py-2" : "py-2.5 sm:py-3",
        ].join(" ")}
      >
        <span className="pl-1 text-ink-muted transition group-focus-within:text-brand-lime" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <input
          id="support-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search billing, subscriptions, invoices..."
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-ink-subtle sm:text-base"
          autoComplete="off"
        />
        <button
          type="submit"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand-lime px-4 py-2 text-sm font-semibold text-canvas transition hover:scale-[1.02] hover:bg-brand-lime-dim active:scale-[0.99]"
        >
          Search
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-ink-subtle">
        Tip: start with a product area — results open in the knowledge base.
      </p>
    </form>
  );
}
