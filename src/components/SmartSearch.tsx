import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function SmartSearch({ compact = false }: { compact?: boolean }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== "/search") return;
    const sp = new URLSearchParams(location.search);
    setQ(sp.get("q") ?? "");
  }, [location.pathname, location.search]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) {
      navigate("/search");
      return;
    }
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "w-full" : "mx-auto max-w-2xl"} role="search">
      <label htmlFor="support-search" className="sr-only">
        Search portal
      </label>
      <div
        className={[
          "group flex items-center border border-zinc-300 bg-white/85 shadow-inner transition",
          "focus-within:border-brand-lime/45 focus-within:shadow-glow focus-within:ring-1 focus-within:ring-brand-lime/30",
          compact
            ? "gap-1.5 rounded-xl px-2 py-1"
            : "gap-2 rounded-2xl px-3 py-2.5 sm:py-3",
        ].join(" ")}
      >
        <span
          className={[
            "shrink-0 text-zinc-500 transition group-focus-within:text-zinc-900",
            compact ? "pl-0.5" : "pl-1",
          ].join(" ")}
          aria-hidden
        >
          <svg className={compact ? "h-4 w-4" : "h-5 w-5"} viewBox="0 0 24 24" fill="none" aria-hidden>
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
          placeholder="Search tickets, docs, invoices, plans, help…"
          className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-500 sm:text-base"
          autoComplete="off"
        />
        <button
          type="submit"
          className={[
            "inline-flex shrink-0 items-center justify-center bg-zinc-700 font-semibold text-white transition hover:bg-zinc-600 active:scale-[0.99]",
            compact
              ? "rounded-lg px-2.5 py-1 text-xs hover:scale-[1.01]"
              : "rounded-xl px-4 py-2 text-sm hover:scale-[1.02]",
          ].join(" ")}
        >
          Search
        </button>
      </div>
      {!compact ? (
        <p className="mt-3 text-center text-xs text-ink-subtle">
          Searches support tickets, workspace files, billing, plans, and the knowledge base.
        </p>
      ) : null}
    </form>
  );
}
