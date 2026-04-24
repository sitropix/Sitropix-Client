export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-lime/25 to-white/5 ring-1 ring-white/10">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v4M12 17v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M3 12h4M17 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
            stroke="#84cc16"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <div className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight text-white">Sitropix</span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
          Support
        </span>
      </div>
    </div>
  );
}
