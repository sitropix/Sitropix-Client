import { useUser } from "@/context/UserContext";

export function Hero() {
  const { contact, loading } = useUser();
  const greeting = loading
    ? "How can we help you?"
    : contact
      ? `Hi ${contact.firstName}, how can we help?`
      : "How can we help you?";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-hero-mesh px-5 py-14 sm:px-10 sm:py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(132,204,22,0.12),transparent_45%)]" />
      <div className="relative mx-auto max-w-3xl text-center opacity-0 animate-fade-up [animation-fill-mode:forwards]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-lime/90">Sitropix Customer Portal</p>
        <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          {greeting}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-sm text-ink-muted sm:text-base">
          Sign in to manage subscriptions, billing, and support from one secure workspace.
        </p>
        <p className="mt-8 text-center text-xs text-ink-subtle">Secure access • Encrypted billing • 99.9% uptime</p>
      </div>
    </section>
  );
}
