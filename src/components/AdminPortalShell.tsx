import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { ReactNode } from "react";

const sideNavClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-3 px-4 py-2.5 text-sm transition",
    isActive
      ? "border-l-2 border-brand-lime bg-white/[0.06] text-brand-lime"
      : "text-ink-muted hover:bg-white/[0.04] hover:text-white",
  ].join(" ");

export function AdminPortalShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth();

  const adminLinks = [
    { to: "/admin", label: "Dashboard", end: true },
    { to: "/admin/customers", label: "Customers" },
    { to: "/admin/plans", label: "Plans" },
    { to: "/admin/invites", label: "Invites" },
    { to: "/admin/features", label: "Feature Controls" },
    { to: "/admin/audit-logs", label: "Audit Logs" },
    { to: "/admin/email", label: "Email" },
    { to: "/admin/tickets", label: "Support" },
  ];

  return (
    <div className="min-h-screen bg-canvas text-white">
      <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-canvas/95 px-6 backdrop-blur">
        <div className="text-lg font-black tracking-tight text-brand-lime">Sitropix Admin</div>
        <div className="flex items-center gap-3">
          <Link to="/admin/plans" className="rounded-lg bg-brand-lime px-3 py-1.5 text-xs font-bold text-canvas">
            Create New Plan
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-ink-muted transition hover:border-brand-lime/35 hover:text-white"
          >
            Logout
          </button>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-16 w-64 border-r border-white/10 bg-[#15191C] p-4">
        <div className="mb-6 px-2">
          <p className="text-base font-bold text-white">Admin Portal</p>
          <p className="text-xs uppercase tracking-wide text-ink-subtle">Enterprise Tier</p>
        </div>
        <nav className="space-y-1">
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

