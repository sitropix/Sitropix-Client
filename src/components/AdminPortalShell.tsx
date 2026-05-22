import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const sideNavClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-3 px-4 py-2.5 text-sm transition",
    isActive
      ? "border-l-2 border-brand-lime bg-white/[0.06] text-brand-lime"
      : "text-ink-muted hover:bg-white/[0.04] hover:text-white",
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

function AdminProfileMenu() {
  const { user, logout } = useAuth();
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

  const displayName = user?.name || "Admin";
  const roleLabel = user?.role?.replace("_", " ").toUpperCase() || "ADMIN";
  const initials = displayName
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "A";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-2 rounded-full bg-white/[0.06] py-1 pl-1 pr-2 outline-none transition",
          "hover:bg-white/[0.1]",
          "focus-visible:ring-2 focus-visible:ring-brand-lime/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
          open ? "bg-white/[0.11]" : "",
        ].join(" ")}
      >
        <span className="sr-only">Open account menu</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-lime/30 to-brand-lime/15 text-[11px] font-bold tracking-tight text-canvas shadow-[0_0_14px_rgba(132,204,22,0.2)]">
          {initials}
        </span>
        <span className="hidden min-w-0 flex-col items-stretch gap-0.5 py-0.5 text-left sm:flex">
          <span className="truncate text-xs font-semibold leading-tight text-white">{displayName}</span>
          <span className="inline-flex w-fit max-w-full">
            <span className="truncate rounded-full bg-brand-lime/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.1em] text-brand-lime">
              {roleLabel}
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
              {roleLabel}
            </p>
          </div>
          {user?.role !== "support" && (
            <>
              <Link
                role="menuitem"
                to="/admin/profile"
                className="block px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.06]"
                onClick={() => setOpen(false)}
              >
                Profile
              </Link>
              <Link
                role="menuitem"
                to="/dashboard"
                className="block px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-white/[0.06] hover:text-white"
                onClick={() => setOpen(false)}
              >
                Client Portal
              </Link>
            </>
          )}
          <button
            type="button"
            role="menuitem"
            className="w-full px-4 py-2.5 text-left text-sm font-medium text-ink-muted hover:bg-white/[0.06] hover:text-white"
            onClick={() => {
              setOpen(false);
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

export function AdminPortalShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isSupportOnly = user?.role === "support";
  const canManageTeamAccess = user?.role === "admin" || user?.role === "master_admin";
  const adminLinks = isSupportOnly
    ? [{ to: "/admin/tickets", label: "Support Tickets", end: true }]
    : [
        { to: "/admin", label: "Dashboard", end: true },
        { to: "/admin/customers", label: "Customers" },
        ...(canManageTeamAccess ? [{ to: "/admin/team-access", label: "Team Access" }] : []),
        { to: "/admin/plans", label: "Plans" },
        { to: "/admin/invites", label: "Invites" },
        { to: "/admin/forms", label: "Forms" },
        { to: "/admin/crm", label: "CRM" },
        { to: "/admin/features", label: "Feature Controls" },
        { to: "/admin/audit-logs", label: "Audit Logs" },
        { to: "/admin/email", label: "Email" },
        { to: "/admin/email-templates", label: "Email Templates" },
        { to: "/admin/environment", label: "Environment" },
        { to: "/admin/tickets", label: "Support" },
      ];

  return (
    <div className="admin-theme min-h-screen bg-canvas text-white">
      <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-[#0a0a0a]/95 px-6 backdrop-blur">
        <div className="text-lg font-black tracking-tight text-brand-lime">
          {isSupportOnly ? "Sitropix Support" : "Sitropix Admin"}
        </div>
        <AdminProfileMenu />
      </header>

      <aside className="fixed bottom-0 left-0 top-16 flex w-64 flex-col overflow-hidden border-r border-white/10 bg-[#15191C]">
        <div className="shrink-0 border-b border-white/10 px-6 py-4">
          <p className="text-base font-bold text-white">
            {isSupportOnly ? "Support Portal" : "Admin Portal"}
          </p>
          <p className="text-xs uppercase tracking-wide text-ink-subtle">
            {isSupportOnly ? "Tickets only" : "Enterprise Tier"}
          </p>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-y-contain px-4 py-4 [-webkit-overflow-scrolling:touch]">
          {adminLinks.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={sideNavClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="ml-64 pt-16">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
