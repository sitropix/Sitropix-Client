import { useUser } from "@/context/UserContext";

export function Hero() {
  const { contact, loading } = useUser();
  const greeting = loading
    ? "How can we help you?"
    : contact
      ? `Hi ${contact.firstName}, how can we help?`
      : "How can we help you?";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white px-5 py-14 shadow-glass sm:px-10 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(196,163,90,0.10),transparent_60%)]"
      />
      <div className="relative mx-auto max-w-3xl text-center opacity-0 animate-fade-up [animation-fill-mode:forwards]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-gold">
          Sitropix Customer Portal
        </p>
        <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl md:text-5xl">
          {greeting}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-sm text-zinc-600 sm:text-base">
          Sign in to manage subscriptions, billing, and support from one secure workspace.
        </p>
        <p className="mt-8 text-xs text-zinc-400">
          Secure access · Encrypted billing · 99.9% uptime
        </p>
      </div>
    </section>
  );
}
