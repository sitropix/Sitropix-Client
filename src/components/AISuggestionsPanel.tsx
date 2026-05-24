/**
 * Concept UI for future AI-assisted answers (in-house assistant / custom LLM).
 * Wire to search debounce + embeddings when backend is ready.
 */
export function AISuggestionsPanel({ query }: { query: string }) {
  const suggestions =
    query.trim().length < 2
      ? []
      : [
          `Try: “${query}” in API keys`,
          "Related: rate limits & retry headers",
          "Billing: usage overages explained",
        ];

  if (suggestions.length === 0) return null;

  return (
    <div className="mt-3 rounded-2xl border border-brand-lime/20 bg-brand-lime/[0.06] p-4 text-left shadow-inner">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-lime">AI suggestions</p>
      <ul className="mt-2 space-y-2">
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              className="w-full rounded-lg px-2 py-2 text-left text-sm text-white/90 transition hover:bg-white/10"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-ink-muted">Preview UI — connect to your support AI endpoint.</p>
    </div>
  );
}
