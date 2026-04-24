import { Breadcrumb } from "@/components/Breadcrumb";
import { Link } from "react-router-dom";

export function CommunityPage() {
  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Community" }]} />
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-10 sm:p-14">
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-brand-lime/15 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-lime">Community</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Connect with other builders</h1>
          <p className="mt-4 text-sm text-ink-muted sm:text-base">
            A moderated space for patterns, integrations, and release notes — launching soon alongside your Desk portal
            SSO.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/kb"
              className="inline-flex rounded-full border border-white/15 bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-white transition hover:border-brand-lime/35 hover:bg-white/[0.08]"
            >
              Browse knowledge base
            </Link>
            <Link
              to="/ticket"
              className="inline-flex rounded-full bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas shadow-glow transition hover:bg-brand-lime-dim"
            >
              Talk to support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
