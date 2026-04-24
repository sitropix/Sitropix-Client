import { Link } from "react-router-dom";

const cards = [
  {
    to: "/kb",
    title: "Knowledge Base",
    description: "Step-by-step guides, billing FAQs, and security docs.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 4h10a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: "/ticket",
    title: "Submit a ticket",
    description: "Tell us what broke — we route to the right specialist.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 7h16v10H4V7Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M8 11h8M8 15h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "/requests",
    title: "My requests",
    description: "Track status, replies, and resolution timelines.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 6h12v14H6V6Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M9 10h6M9 14h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "/community",
    title: "Community",
    description: "Learn from other builders — tips, patterns, and updates.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM4 18v-1a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v1"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M16 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM13 18.5V18a3 3 0 0 1 3-3h1"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
] as const;

export function ActionCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <Link
          key={card.to}
          to={card.to}
          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-glass transition duration-300 hover:-translate-y-1 hover:border-brand-lime/25 hover:bg-white/[0.05] hover:shadow-lift"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="pointer-events-none absolute inset-0 bg-card-shine opacity-0 transition group-hover:opacity-100" />
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-lime/10 text-brand-lime ring-1 ring-brand-lime/20 transition group-hover:scale-105">
            {card.icon}
          </div>
          <h3 className="text-base font-semibold text-white">{card.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{card.description}</p>
          <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-brand-lime">
            Open
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
        </Link>
      ))}
    </div>
  );
}
