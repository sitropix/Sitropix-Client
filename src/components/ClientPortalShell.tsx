import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import { useUser } from "@/context/UserContext";

const portalLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition",
    isActive
      ? "bg-brand-lime/15 text-white ring-1 ring-brand-lime/30"
      : "text-ink-muted hover:bg-white/[0.06] hover:text-white",
  ].join(" ");

export function ClientPortalShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const { isAdmin } = useAuthz();
  const { contact, subscription } = useUser();

  const pendingCount = subscription ? 1 : 0;
  const displayName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : "Customer";
  const initials = contact?.firstName?.charAt(0)?.toUpperCase() ?? "C";

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
        <div className="mx-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-semibold text-brand-lime">Growth plan</p>
          <p className="mt-1 text-[11px] text-ink-subtle">Enable more automation and faster support response.</p>
          <Link
            to="/subscription"
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-brand-lime px-3 py-2 text-xs font-semibold text-canvas"
          >
            Manage plan
          </Link>
        </div>
        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full rounded-full border border-white/15 px-4 py-2 text-sm text-ink-muted transition hover:border-brand-lime/35 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      <section className="min-h-screen lg:ml-[260px]">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-canvas/90 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white lg:hidden"
            >
              Menu
            </button>
            <div className="relative hidden md:block">
              <input
                className="w-80 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white placeholder:text-ink-subtle focus:border-brand-lime/35 focus:outline-none"
                placeholder="Search subscriptions or invoices..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/ticket"
              className="rounded-lg bg-brand-lime px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-canvas"
            >
              New Ticket
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-white">{displayName}</p>
              <p className="text-[10px] uppercase tracking-wide text-ink-subtle">{subscription?.planName ?? "Workspace"}</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-semibold text-brand-lime">
              {initials}
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
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="rounded-lg border border-white/15 px-3 py-2 text-left text-sm text-ink-muted"
            >
              Sign out
            </button>
          </nav>
        )}

        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </section>
    </div>
  );
}
