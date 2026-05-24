import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { adminHomePath } from "@/lib/adminAccess";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import { SxButton } from "@/components/sx/Button";
import { SxLogo } from "@/components/sx/Logo";
import {
  America250Banner,
  America250FooterLine,
  America250Kicker,
} from "@/components/america250";
import { isAmerica250Active } from "@/lib/america250";

const PROMISES = [
  {
    title: "Send a ticket. Get it done.",
    body: "Describe what you want changed. We handle copy, layout, photos, publishing — no plugins, no builders.",
  },
  {
    title: "Fast, not flashy.",
    body: "Most edits land within a business day. The Pro plan turns around same-day.",
  },
  {
    title: "Looks like you paid more.",
    body: "Typography-led, fast, accessible sites — even on the Starter plan.",
  },
  {
    title: "Predictable bill, no surprises.",
    body: "Flat monthly subscription. Edit credits roll over. We tell you before you hit a limit.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$59",
    tagline: "For owner-operators getting their first site online.",
    features: ["5 edit credits / month", "Hosting & SSL included", "Email support · 1-day reply"],
    cta: "Choose Starter",
    ctaVariant: "secondary" as const,
  },
  {
    name: "Growth",
    price: "$109",
    tagline: "For businesses ready to scale and update often.",
    features: ["15 edit credits / month", "Priority support · 4-hr reply", "Monthly performance report"],
    cta: "Choose Growth",
    ctaVariant: "primary" as const,
    featured: true,
  },
  {
    name: "Pro",
    price: "$199",
    tagline: "For multi-location and high-volume customers.",
    features: ["Unlimited edit credits", "Same-day turnaround", "Dedicated account lead"],
    cta: "Choose Pro",
    ctaVariant: "cta" as const,
  },
];

export function HomePage() {
  const { isAuthenticated, loading } = useAuth();
  const { role, canAccessAdminPortal } = useAuthz();

  useEffect(() => {
    document.title = "Sitropix — A website that just works";
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sx-sm text-[var(--text-tertiary)]">
        Loading…
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to={canAccessAdminPortal ? adminHomePath(role) : "/dashboard"}
        replace
      />
    );
  }

  const a250Active = isAmerica250Active();

  return (
    <div data-sx-root className="bg-[var(--surface-page)] text-[var(--text-primary)]">
      <America250Banner />

      {/* Top nav (sits below the America 250 banner when active). */}
      <header
        className={[
          "sticky z-40 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]/95 backdrop-blur",
          a250Active ? "top-[36px] sm:top-[40px]" : "top-0",
        ].join(" ")}
      >
        <div className="mx-auto flex h-16 max-w-[var(--container-wide)] items-center justify-between px-6">
          <SxLogo to="/" size="md" />
          <nav className="hidden items-center gap-6 text-sx-sm text-[var(--text-secondary)] md:flex">
            <a href="#promises" className="hover:text-[var(--text-primary)]">
              How it works
            </a>
            <a href="#plans" className="hover:text-[var(--text-primary)]">
              Plans
            </a>
            <Link to="/community" className="hover:text-[var(--text-primary)]">
              Community
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <SxButton variant="ghost" size="sm">
                Sign in
              </SxButton>
            </Link>
            <Link to="/signup">
              <SxButton variant="cta" size="sm">
                Start free trial
              </SxButton>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[var(--surface-page)] py-24 md:py-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-sx-hero opacity-90"
        />
        <div className="relative mx-auto max-w-[var(--container-wide)] px-6">
          <div className="inline-flex items-center gap-2 font-mono text-sx-xs uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
            <span className="h-px w-6 bg-[var(--color-ink-300)]" />
            Sitropix · Brand &amp; Product Identity
          </div>
          <div className="mt-5">
            <America250Kicker />
          </div>
          <h1 className="max-w-[14ch] font-display text-[2.75rem] font-medium leading-[1.05] text-[var(--text-primary)] [letter-spacing:var(--tracking-tight)] sm:text-[3.5rem] md:text-sx-4xl">
            A website that just{" "}
            <em className="font-normal italic text-[var(--text-brand)]">works.</em>
          </h1>
          <p className="mt-5 max-w-2xl text-sx-lg leading-relaxed text-[var(--text-secondary)]">
            Sitropix is a managed website service for small businesses. Subscribe, send edits by ticket, and get a polished web presence — without ever touching a builder.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/signup">
              <SxButton variant="cta" size="lg">
                Start your 14-day trial
              </SxButton>
            </Link>
            <a href="#plans">
              <SxButton variant="secondary" size="lg">
                See plans
              </SxButton>
            </a>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 text-sx-xs text-[var(--text-tertiary)]">
            <span>Cancel anytime · no setup fees</span>
            <span>Hosting &amp; SSL included</span>
            <span>Most edits live within a business day</span>
          </div>
        </div>
      </section>

      {/* Promises */}
      <section id="promises" className="border-y border-[var(--border-subtle)] bg-[var(--surface-card)] py-20">
        <div className="mx-auto max-w-[var(--container-wide)] px-6">
          <header className="grid gap-3 md:grid-cols-[200px_1fr] md:gap-10">
            <div className="font-mono text-sx-sm font-medium text-[var(--text-brand)]">
              <span className="block border-t-2 border-[var(--color-brand-500)] pt-3">01 / Promise</span>
            </div>
            <div>
              <h2 className="font-display text-sx-2xl font-medium leading-tight text-[var(--text-primary)] [letter-spacing:var(--tracking-tight)] md:text-sx-3xl">
                What you get when you subscribe.
              </h2>
              <p className="mt-3 max-w-2xl text-sx-md leading-relaxed text-[var(--text-secondary)]">
                Four promises we make to every customer — and measure ourselves against.
              </p>
            </div>
          </header>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {PROMISES.map((p) => (
              <article
                key={p.title}
                className="rounded-sx-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6"
              >
                <div className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  Promise
                </div>
                <h3 className="mt-3 font-ui text-sx-lg font-semibold text-[var(--text-primary)]">
                  {p.title}
                </h3>
                <p className="mt-2 text-sx-sm leading-relaxed text-[var(--text-secondary)]">
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="bg-[var(--surface-page)] py-20">
        <div className="mx-auto max-w-[var(--container-wide)] px-6">
          <header className="grid gap-3 md:grid-cols-[200px_1fr] md:gap-10">
            <div className="font-mono text-sx-sm font-medium text-[var(--text-brand)]">
              <span className="block border-t-2 border-[var(--color-brand-500)] pt-3">02 / Plans</span>
            </div>
            <div>
              <h2 className="font-display text-sx-2xl font-medium leading-tight text-[var(--text-primary)] [letter-spacing:var(--tracking-tight)] md:text-sx-3xl">
                Predictable monthly pricing.
              </h2>
              <p className="mt-3 max-w-2xl text-sx-md leading-relaxed text-[var(--text-secondary)]">
                One flat price. Edit credits roll over. Add-ons are opt-in.
              </p>
            </div>
          </header>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => (
              <article
                key={plan.name}
                className={[
                  "relative flex flex-col gap-4 rounded-sx-xl border bg-[var(--surface-card)] p-6 transition-all duration-[220ms]",
                  "hover:-translate-y-0.5 hover:shadow-sx-lg",
                  plan.featured
                    ? "border-[var(--color-brand-500)] shadow-[0_0_0_1px_var(--color-brand-500)]"
                    : "border-[var(--border-default)]",
                ].join(" ")}
              >
                {plan.featured ? (
                  <span className="absolute -top-2.5 left-5 inline-flex items-center rounded-sx-sm bg-[var(--color-brand-500)] px-3 py-1 font-ui text-sx-2xs font-semibold uppercase tracking-[0.12em] text-white">
                    Most popular
                  </span>
                ) : null}
                <div className="font-ui text-sx-md font-semibold text-[var(--text-brand)]">
                  {plan.name}
                </div>
                <div className="font-display text-sx-3xl font-semibold leading-none text-[var(--text-primary)] [letter-spacing:var(--tracking-tight)]">
                  {plan.price}
                  <small className="ml-1 font-ui text-sx-sm font-normal text-[var(--text-tertiary)]">
                    / month
                  </small>
                </div>
                <p className="text-sx-sm leading-relaxed text-[var(--text-secondary)]">
                  {plan.tagline}
                </p>
                <ul className="flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-4 text-sx-sm text-[var(--text-secondary)]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span
                        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success-fg)] text-[11px] font-bold"
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-2">
                  <Link to="/signup">
                    <SxButton variant={plan.ctaVariant} fullWidth>
                      {plan.cta}
                    </SxButton>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-[var(--color-brand-700)] py-20 text-white">
        <div className="mx-auto grid max-w-[var(--container-wide)] gap-8 px-6 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <h2 className="font-display text-sx-2xl font-medium leading-tight [letter-spacing:var(--tracking-tight)] md:text-sx-3xl">
              Ready to send your first ticket?
            </h2>
            <p className="mt-3 max-w-xl text-sx-md leading-relaxed text-white/80">
              Start the trial, describe your business, and we'll have a polished site ready in a few days.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <Link to="/signup">
              <SxButton variant="cta" size="lg">
                Start free trial
              </SxButton>
            </Link>
            <Link to="/login">
              <SxButton
                variant="secondary"
                size="lg"
                className="!border-white/30 !bg-transparent !text-white hover:!bg-white/10"
              >
                Sign in
              </SxButton>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-card)] py-10">
        <div className="mx-auto flex max-w-[var(--container-wide)] flex-col items-center gap-4 px-6">
          <America250FooterLine />
          <div className="flex w-full flex-wrap items-center justify-between gap-4 text-sx-xs text-[var(--text-tertiary)]">
            <div className="flex items-center gap-3">
              <SxLogo to="/" size="sm" />
              <span>© {new Date().getFullYear()} Sitropix</span>
            </div>
            <div>
              Maintained by{" "}
              <a
                href="https://www.draconx.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--text-brand)] hover:underline"
              >
                DraconX
              </a>
              . Sitropix is a product of DraconX Inc., United States of America.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
