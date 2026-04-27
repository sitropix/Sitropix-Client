import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { SmartSearch } from "@/components/SmartSearch";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import { useUser } from "@/context/UserContext";

const portalLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center justify-between gap-2 rounded-lg border-l-2 py-2.5 pl-2.5 pr-3 text-sm font-medium transition",
    isActive
      ? "border-l-brand-lime bg-brand-lime/20 text-white shadow-[inset_0_0_0_1px_rgba(132,204,22,0.28)]"
      : "border-l-transparent text-ink-muted hover:border-l-white/10 hover:bg-white/[0.07] hover:text-white",
  ].join(" ");

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function HeaderProfileMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { logout } = useAuth();
  const { contact, subscription } = useUser();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const displayName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : "Customer";
  const planLabel = subscription?.planName?.trim() || "Workspace";
  const initials =
    `${contact?.firstName?.charAt(0) ?? ""}${contact?.lastName?.charAt(0) ?? ""}`.trim() || "?";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex max-w-[min(100vw-8rem,15rem)] items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pl-1 pr-1.5 outline-none transition sm:max-w-[17rem] sm:gap-2 sm:pr-2",
          "hover:bg-white/[0.1]",
          "focus-visible:ring-2 focus-visible:ring-brand-lime/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
          open ? "bg-white/[0.11]" : "",
        ].join(" ")}
      >
        <span className="sr-only">Open account menu</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-lime/30 to-brand-lime/15 text-[11px] font-bold tracking-tight text-canvas shadow-[0_0_14px_rgba(132,204,22,0.2)]">
          {initials}
        </span>
        <span className="hidden min-w-0 flex-1 flex-col items-stretch gap-0.5 py-0.5 text-left sm:flex">
          <span className="truncate text-xs font-semibold leading-tight text-white">{displayName}</span>
          <span className="inline-flex w-fit max-w-full">
            <span className="truncate rounded-full bg-brand-lime/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.1em] text-brand-lime">
              {planLabel}
            </span>
          </span>
        </span>
        <ChevronDown
          className={[
            "h-3.5 w-3.5 shrink-0 text-ink-muted transition",
            open ? "rotate-180 text-brand-lime" : "",
          ].join(" ")}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[60] mt-2 min-w-[200px] overflow-hidden rounded-xl border border-white/10 bg-[#12181f] py-1 shadow-glass ring-1 ring-black/40"
        >
          <div className="border-b border-white/10 px-4 py-3 sm:hidden">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="mt-1.5 inline-flex max-w-full truncate rounded-md border border-brand-lime/30 bg-brand-lime/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-lime">
              {planLabel}
            </p>
          </div>
          <Link
            role="menuitem"
            to="/profile"
            className="block px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.06]"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
          >
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            className="w-full px-4 py-2.5 text-left text-sm font-medium text-ink-muted hover:bg-white/[0.06] hover:text-white"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
              void logout();
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export function ClientPortalShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { isAdmin } = useAuthz();
  const { subscription, portal } = useUser();

  const pendingCount = subscription ? 1 : 0;

  const sortedPlans = [...(portal?.plans ?? [])].sort((a, b) => a.priceMonthlyCents - b.priceMonthlyCents);
  const currentPlanId = subscription?.planId ?? portal?.subscription?.planId ?? null;
  const currentIdx =
    currentPlanId != null ? sortedPlans.findIndex((p) => p.id === currentPlanId) : -1;
  const nextPlan =
    currentIdx >= 0 && currentIdx < sortedPlans.length - 1 ? sortedPlans[currentIdx + 1] : null;

  const links = [
    { to: "/dashboard", label: "Home" },
    { to: "/subscription-management", label: "Subscription Management", badge: pendingCount },
    { to: "/subscription", label: "Subscriptions" },
    { to: "/requests", label: "Support" },
    { to: "/workspace", label: "Workspace Files" },
    { to: "/kb", label: "Knowledge Base" },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed left-0 top-0 z-50 hidden h-full w-[260px] flex-col border-r border-white/[0.14] bg-gradient-to-b from-[#121a22] via-[#0f161c] to-[#0b1016] shadow-[inset_-1px_0_0_rgba(255,255,255,0.06),6px_0_32px_rgba(0,0,0,0.45)] lg:flex">
        <div className="relative shrink-0 border-b border-white/10 bg-black/20 px-5 py-5">
          <div
            className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-lime/35 to-transparent"
            aria-hidden
          />
          <Link
            to="/dashboard"
            className="inline-flex rounded-xl outline-none ring-brand-lime/25 transition hover:bg-white/[0.04] focus-visible:ring-2"
          >
            <Logo />
          </Link>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-4" aria-label="Portal navigation">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.09] bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="shrink-0 border-b border-white/10 bg-black/20 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">Workspace</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              <div className="space-y-0.5">
                {links.map((item) => (
                  <NavLink key={item.to} to={item.to} className={portalLinkClass} end={item.to === "/dashboard"}>
                    <span className="min-w-0 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-ink-muted ring-1 ring-white/10">
                        {item.badge}
                      </span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
              {isAdmin ? (
                <>
                  <div className="my-2 border-t border-white/10" role="presentation" />
                  <NavLink to="/admin" className={portalLinkClass}>
                    <span className="min-w-0 truncate">Admin</span>
                  </NavLink>
                </>
              ) : null}
            </div>
          </div>
        </nav>
        {nextPlan ? (
          <div className="shrink-0 border-t border-white/10 bg-black/25 px-3 pb-5 pt-4">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">Upgrade</p>
            <div className="rounded-xl border border-brand-lime/25 bg-gradient-to-br from-brand-lime/[0.1] via-white/[0.02] to-transparent p-3.5 shadow-glass ring-1 ring-white/[0.05]">
              <p className="text-xs font-semibold text-brand-lime">Upgrade to {nextPlan.name}</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-subtle">
                Move up from {subscription?.planName ?? "your current plan"} for more capacity and support.
              </p>
              <Link
                to="/subscription"
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-brand-lime px-3 py-2.5 text-xs font-semibold text-canvas shadow-glow transition hover:bg-brand-lime-dim"
              >
                View {nextPlan.name}
              </Link>
            </div>
          </div>
        ) : null}
      </aside>

      <section className="min-h-screen lg:ml-[260px]">
        <header className="sticky top-0 z-40 grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-white/10 bg-canvas/90 px-3 backdrop-blur sm:gap-x-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)_minmax(0,1fr)] lg:gap-x-4 lg:px-8">
          <div className="flex min-w-0 items-center justify-self-start">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-medium text-white lg:hidden"
            >
              Menu
            </button>
          </div>
          <div className="w-full min-w-0 justify-self-center px-1 sm:px-2">
            <SmartSearch compact />
          </div>
          <div className="flex shrink-0 items-center justify-self-end">
            <HeaderProfileMenu onNavigate={() => setOpen(false)} />
          </div>
        </header>

        {open && (
          <nav
            className="border-b border-white/10 bg-canvas px-4 py-4 lg:hidden"
            aria-label="Portal navigation"
          >
            <div className="overflow-hidden rounded-xl border border-white/[0.09] bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="border-b border-white/10 bg-black/20 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">Workspace</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-2">
                {links.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={portalLinkClass}
                    end={item.to === "/dashboard"}
                    onClick={() => setOpen(false)}
                  >
                    <span className="min-w-0 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-ink-muted ring-1 ring-white/10">
                        {item.badge}
                      </span>
                    ) : null}
                  </NavLink>
                ))}
                {isAdmin && (
                  <NavLink to="/admin" className={portalLinkClass} onClick={() => setOpen(false)}>
                    <span className="min-w-0 truncate">Admin</span>
                  </NavLink>
                )}
              </div>
            </div>
            {nextPlan && (
              <div className="mt-3">
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">Upgrade</p>
                <div className="rounded-xl border border-brand-lime/25 bg-gradient-to-br from-brand-lime/[0.1] to-transparent p-3 ring-1 ring-white/[0.05]">
                  <p className="text-xs font-semibold text-brand-lime">Upgrade to {nextPlan.name}</p>
                  <Link
                    to="/subscription"
                    className="mt-2 block rounded-lg bg-brand-lime py-2.5 text-center text-xs font-semibold text-canvas shadow-glow"
                    onClick={() => setOpen(false)}
                  >
                    View {nextPlan.name}
                  </Link>
                </div>
              </div>
            )}
          </nav>
        )}

        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </section>
    </div>
  );
}
