import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { SmartSearch } from "@/components/SmartSearch";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import { useSubscriptionPortal } from "@/context/SubscriptionPortalContext";
import { useUser } from "@/context/UserContext";
import type { Plan } from "@/types/subscription";

const portalLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition",
    isActive
      ? "bg-brand-lime/15 text-white ring-1 ring-brand-lime/30"
      : "text-ink-muted hover:bg-white/[0.06] hover:text-white",
  ].join(" ");

function sortedActivePlans(plans: Plan[]) {
  return [...plans].filter((p) => p.isActive && !p.archivedAt).sort((a, b) => a.priceMonthlyCents - b.priceMonthlyCents);
}

export function ClientPortalShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { logout, user } = useAuth();
  const { isAdmin } = useAuthz();
  const { contact, subscription } = useUser();
  const { data: portalData, loading: portalLoading } = useSubscriptionPortal();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!profileRef.current?.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    void import("@/pages/KnowledgeBasePage");
    void import("@/pages/ArticlePage");
    void import("@/pages/PortalSearchPage");
  }, []);

  const pendingCount = subscription ? 1 : 0;
  const displayName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : user?.name?.trim() || "Customer";
  const displayEmail = contact?.email ?? user?.email ?? "";
  const initials =
    (contact?.firstName?.charAt(0) || user?.name?.charAt(0) || user?.email?.charAt(0) || "C").toUpperCase();

  const { nextPlan, hideGrowthUpsell } = useMemo(() => {
    const plans = portalData?.plans?.length ? sortedActivePlans(portalData.plans) : [];
    const sub = portalData?.subscription;
    if (!plans.length) return { nextPlan: null, hideGrowthUpsell: false };
    if (!sub?.planId) return { nextPlan: plans[0] ?? null, hideGrowthUpsell: false };
    const idx = plans.findIndex((p) => p.id === sub.planId);
    if (idx < 0) return { nextPlan: plans[0] ?? null, hideGrowthUpsell: false };
    const next = plans[idx + 1] ?? null;
    return { nextPlan: next, hideGrowthUpsell: !next };
  }, [portalData?.plans, portalData?.subscription]);

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
      <aside className="fixed left-0 top-0 z-50 hidden h-full w-[260px] border-r border-white/10 bg-[#10171d] py-6 lg:flex lg:flex-col">
        <div className="px-6">
          <Link to="/dashboard">
            <Logo />
          </Link>
        </div>
        <nav className="mt-8 flex-1 space-y-1 px-4">
          {links.map((item) => (
            <NavLink key={item.to} to={item.to} className={portalLinkClass} end={item.to === "/dashboard"}>
              <span>{item.label}</span>
              {item.badge ? (
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-ink-subtle">{item.badge}</span>
              ) : null}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/admin" className={portalLinkClass}>
              Admin
            </NavLink>
          )}
        </nav>
        {!portalLoading && !hideGrowthUpsell && (
          <div className="mx-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold text-brand-lime">Manage plan</p>
            <p className="mt-1 text-[11px] text-ink-subtle">
              {nextPlan && portalData?.subscription
                ? `Upgrade to ${nextPlan.name} for more capacity and priority support.`
                : "Choose a plan to unlock automation, billing tools, and faster support."}
            </p>
            <Link
              to="/subscription"
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-brand-lime px-3 py-2 text-xs font-semibold text-canvas"
            >
              {nextPlan && portalData?.subscription ? `Upgrade to ${nextPlan.name}` : "Upgrade to Pro"}
            </Link>
          </div>
        )}
      </aside>

      <section className="min-h-screen lg:ml-[260px]">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-canvas/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white lg:hidden"
                >
                  Menu
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <SmartSearch compact />
              </div>
            </div>
            <div className="relative flex shrink-0 items-center justify-end gap-3" ref={profileRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileOpen((v) => !v);
                }}
                className="flex max-w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-3 text-left transition hover:border-brand-lime/30"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-sm font-semibold text-brand-lime">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                  <p className="truncate text-[10px] uppercase tracking-wide text-ink-subtle">
                    {subscription?.planName ?? portalData?.subscription?.plan?.name ?? "Workspace"}
                  </p>
                </div>
              </button>
              {profileOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-[#15191c] py-2 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {displayEmail ? (
                    <p className="border-b border-white/10 px-3 py-2 text-xs text-ink-muted">{displayEmail}</p>
                  ) : null}
                  <Link
                    role="menuitem"
                    to="/profile"
                    className="block px-3 py-2 text-sm text-white hover:bg-white/[0.06]"
                    onClick={() => setProfileOpen(false)}
                  >
                    My Profile
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2 text-left text-sm text-ink-muted hover:bg-white/[0.06] hover:text-white"
                    onClick={() => {
                      setProfileOpen(false);
                      void logout();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {open && (
          <nav className="grid grid-cols-2 gap-2 border-b border-white/10 bg-canvas px-4 py-3 lg:hidden">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={portalLinkClass}
                end={item.to === "/dashboard"}
                onClick={() => setOpen(false)}
              >
                <span>{item.label}</span>
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink to="/admin" className={portalLinkClass} onClick={() => setOpen(false)}>
                Admin
              </NavLink>
            )}
            {!hideGrowthUpsell && (
              <Link
                to="/subscription"
                className="col-span-2 rounded-lg border border-brand-lime/25 bg-brand-lime/10 px-3 py-2 text-center text-sm font-semibold text-brand-lime"
                onClick={() => setOpen(false)}
              >
                {nextPlan && portalData?.subscription ? `Upgrade to ${nextPlan.name}` : "Upgrade to Pro"}
              </Link>
            )}
          </nav>
        )}

        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </section>
    </div>
  );
}
