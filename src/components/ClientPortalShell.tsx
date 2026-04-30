import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { SmartSearch } from "@/components/SmartSearch";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";

const portalLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "portal-nav-link flex items-center justify-between gap-2 rounded-lg border-l-2 py-2.5 pl-2.5 pr-3 text-sm font-medium transition",
    isActive
      ? "border-l-brand-lime bg-white text-zinc-900 shadow-[inset_0_0_0_1px_rgba(112,111,112,0.2)]"
      : "border-l-transparent text-zinc-600 hover:border-l-zinc-300 hover:bg-white/70 hover:text-zinc-900",
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

function ThemeToggleIcon({ dark }: { dark: boolean }) {
  if (dark) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 3v1.5M12 19.5V21M4.5 12H3m18 0h-1.5M6.22 6.22l-1.06-1.06m13.62 13.62-1.06-1.06M17.78 6.22l1.06-1.06M6.22 17.78l-1.06 1.06" />
        <circle cx="12" cy="12" r="4.25" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M21 12.79A9 9 0 1111.21 3c-.01.1-.01.2-.01.3A7.5 7.5 0 0018.7 10.8c.1 0 .2 0 .3-.01z" />
    </svg>
  );
}

function HeaderProfileMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
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
  const initials = (
    contact?.firstName?.trim().charAt(0) ||
    contact?.lastName?.trim().charAt(0) ||
    displayName.trim().charAt(0) ||
    "?"
  ).toUpperCase();

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={[
          "profile-liquid-card flex max-w-[min(100vw-6.5rem,10.5rem)] items-center gap-1.5 rounded-full border border-zinc-300 bg-white/85 py-0.5 pl-1 pr-1.5 outline-none transition sm:max-w-[11.5rem] sm:gap-2 sm:pr-2",
          "hover:bg-white",
          "focus-visible:ring-2 focus-visible:ring-brand-lime/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
          open ? "bg-white profile-liquid-open" : "",
        ].join(" ")}
      >
        <span className="sr-only">Open account menu</span>
        <span className="profile-liquid-avatar grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-700 text-[11px] font-bold tracking-tight text-white shadow-sm">
          {initials}
        </span>
        <span className="hidden min-w-0 flex-1 items-center py-0.5 text-left sm:flex">
          <span className="inline-flex w-fit max-w-full">
            <span className="profile-liquid-plan truncate rounded-full bg-zinc-200 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-700">
              {planLabel}
            </span>
          </span>
        </span>
        <ChevronDown
          className={[
            "profile-liquid-chevron h-3.5 w-3.5 shrink-0 text-zinc-500 transition",
            open ? "rotate-180 text-zinc-800" : "",
          ].join(" ")}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[60] mt-2 min-w-[200px] overflow-hidden rounded-xl border border-zinc-300 bg-white py-1 shadow-glass"
        >
          <div className="border-b border-zinc-200 px-4 py-3 sm:hidden">
            <p className="truncate text-sm font-semibold text-zinc-900">{displayName}</p>
            <p className="mt-1.5 inline-flex max-w-full truncate rounded-md border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-700">
              {planLabel}
            </p>
          </div>
          <Link
            role="menuitem"
            to="/profile"
            className="block px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
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
            className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
              toggleTheme();
            }}
          >
            Switch to {isDark ? "Light" : "Dark"} mode
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
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
  const { isDark, toggleTheme } = useTheme();
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
    { to: "/subscription", label: "Plans & Addon" },
    { to: "/projects", label: "My Projects" },
    { to: "/requests", label: "Support" },
    { to: "/workspace", label: "Workspace Files" },
    { to: "/kb", label: "Knowledge Base" },
  ];

  return (
    <div className="min-h-screen bg-[#ebedf1] text-zinc-900">
      <aside className="portal-sidebar fixed left-0 top-0 z-50 hidden h-full w-[260px] flex-col border-r border-zinc-300 bg-[#d4d8df] shadow-[inset_-1px_0_0_rgba(112,111,112,0.18),6px_0_24px_rgba(53,53,54,0.15)] lg:flex">
        <div className="shrink-0 flex h-14 items-center border-b border-zinc-300 bg-white/40 px-5">
          <Link
            to="/dashboard"
            className="inline-flex rounded-xl outline-none ring-zinc-400 transition hover:bg-white/60 focus-visible:ring-2"
          >
            <Logo />
          </Link>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-4" aria-label="Portal navigation">
          <div className="portal-sidebar-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white/70">
            <div className="portal-sidebar-header shrink-0 border-b border-zinc-300 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Workspace</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              <div className="space-y-0.5">
                {links.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={portalLinkClass}
                    end={item.to === "/dashboard"}
                    title={item.label}
                  >
                    <span className="min-w-0 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="portal-nav-badge shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600 ring-1 ring-zinc-300">
                        {item.badge}
                      </span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
              {isAdmin ? (
                <>
                  <div className="my-2 border-t border-zinc-300" role="presentation" />
                  <NavLink to="/admin" className={portalLinkClass}>
                    <span className="min-w-0 truncate">Admin</span>
                  </NavLink>
                </>
              ) : null}
            </div>
          </div>
        </nav>
      </aside>

      <section className="min-h-screen bg-[#ebedf1] lg:ml-[260px]">
        <header className="sticky top-0 z-40 grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-zinc-300 bg-[#ebedf1]/95 px-3 backdrop-blur sm:gap-x-3 sm:px-4 lg:grid-cols-[17rem_minmax(0,36rem)_17rem] lg:gap-x-4 lg:px-8">
          <div className="flex min-w-0 items-center justify-self-start">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-800 lg:hidden"
            >
              Menu
            </button>
          </div>
          <div className="w-full min-w-0 justify-self-center px-1 sm:px-2 lg:px-0">
            <SmartSearch compact />
          </div>
          <div className="flex min-w-0 shrink-0 items-center justify-self-end gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 bg-white/85 text-zinc-700 transition hover:bg-white hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
              title={`Switch to ${isDark ? "light" : "dark"} mode`}
            >
              <ThemeToggleIcon dark={isDark} />
            </button>
            <HeaderProfileMenu onNavigate={() => setOpen(false)} />
          </div>
        </header>

        {open && (
          <nav
            className="border-b border-zinc-300 bg-[#ebedf1] px-4 py-4 lg:hidden"
            aria-label="Portal navigation"
          >
            <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white/80">
              <div className="border-b border-zinc-300 bg-white/70 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Workspace</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-2">
                {links.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={portalLinkClass}
                    end={item.to === "/dashboard"}
                    title={item.label}
                    onClick={() => setOpen(false)}
                  >
                    <span className="min-w-0 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600 ring-1 ring-zinc-300">
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
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Upgrade</p>
                <div className="rounded-xl border border-zinc-300 bg-white p-3">
                  <p className="text-xs font-semibold text-zinc-900">Upgrade to {nextPlan.name}</p>
                  <Link
                    to="/subscription"
                    className="mt-2 block rounded-lg bg-black py-2.5 text-center text-xs font-semibold text-white shadow-sm hover:bg-zinc-900"
                    onClick={() => setOpen(false)}
                  >
                    View {nextPlan.name}
                  </Link>
                </div>
              </div>
            )}
          </nav>
        )}

        <main className="bg-[#ebedf1] px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </section>
    </div>
  );
}
