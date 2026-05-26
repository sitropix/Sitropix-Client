import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import { SxLogo } from "@/components/sx/Logo";

const ADMIN_TITLES: Array<[RegExp, string]> = [
  [/^\/admin\/?$/, "Admin"],
  [/^\/admin\/customers/, "Customers"],
  [/^\/admin\/tickets\/[^/]+/, "Ticket"],
  [/^\/admin\/tickets/, "Tickets"],
  [/^\/admin\/projects/, "Projects"],
  [/^\/admin\/crm/, "CRM"],
  [/^\/admin\/plans/, "Plans"],
  [/^\/admin\/forms/, "Forms"],
  [/^\/admin\/invites/, "Invites"],
  [/^\/admin\/features/, "Feature flags"],
  [/^\/admin\/audit-logs/, "Audit logs"],
  [/^\/admin\/team/, "Team"],
  [/^\/admin\/settings\/email-templates/, "Email templates"],
  [/^\/admin\/settings\/email/, "Email"],
  [/^\/admin\/settings\/environment/, "Environment"],
  [/^\/admin\/account/, "Account"],
  [/^\/admin\/users\/[^/]+\/documents/, "Customer documents"],
];

function adminTitleForPath(pathname: string): string {
  for (const [pattern, label] of ADMIN_TITLES) {
    if (pattern.test(pathname)) return `${label} · Admin · Sitropix`;
  }
  return "Admin · Sitropix";
}

const sideNavClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-2.5 rounded-sx-md px-3 py-1.5 font-ui text-sx-sm transition-colors duration-[150ms] ease-[cubic-bezier(0.2,0,0,1)] outline-none focus-visible:shadow-sx-focus",
    isActive
      ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)] font-semibold"
      : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]",
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

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18M3 12h18M3 18h18" />
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
  const initials =
    displayName
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
          "flex items-center gap-2 rounded-sx-md border bg-[var(--surface-card)] py-1 pl-1 pr-2 outline-none transition-colors duration-[150ms]",
          "border-[var(--border-subtle)] hover:border-[var(--border-strong)]",
          "focus-visible:shadow-sx-focus",
          open ? "border-[var(--border-strong)]" : "",
        ].join(" ")}
      >
        <span className="sr-only">Open account menu</span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sx-sm bg-[var(--color-brand-500)] text-[11px] font-bold tracking-tight text-white">
          {initials}
        </span>
        <span className="hidden min-w-0 flex-col items-stretch gap-0.5 py-0.5 text-left sm:flex">
          <span className="truncate font-ui text-sx-xs font-semibold leading-tight text-[var(--text-primary)]">
            {displayName}
          </span>
          <span className="truncate font-mono text-sx-2xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            {roleLabel}
          </span>
        </span>
        <ChevronDown
          className={[
            "h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[60] mt-2 min-w-[220px] overflow-hidden rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] py-1 shadow-sx-lg"
        >
          <div className="border-b border-[var(--border-subtle)] px-4 py-2.5 sm:hidden">
            <p className="truncate font-ui text-sx-sm font-semibold text-[var(--text-primary)]">
              {displayName}
            </p>
            <p className="mt-1 font-mono text-sx-2xs uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              {roleLabel}
            </p>
          </div>
          {user?.role !== "support" && (
            <>
              <Link
                role="menuitem"
                to="/admin/account"
                className="block px-4 py-2 font-ui text-sx-sm text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
                onClick={() => setOpen(false)}
              >
                Account
              </Link>
              <Link
                role="menuitem"
                to="/dashboard"
                className="block px-4 py-2 font-ui text-sx-sm text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
                onClick={() => setOpen(false)}
              >
                Customer portal
              </Link>
            </>
          )}
          <button
            type="button"
            role="menuitem"
            className="w-full px-4 py-2 text-left font-ui text-sx-sm font-medium text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-bg)]"
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

type AdminLink = { to: string; label: string; end?: boolean; module?: string };
type AdminGroup = { heading?: string; items: AdminLink[] };

export function AdminPortalShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { hasModule, modulesLoading } = useAuthz();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isSupportOnly = user?.role === "support";
  const canManageTeamAccess =
    user?.role === "admin" || user?.role === "master_admin";

  useEffect(() => {
    document.title = adminTitleForPath(pathname);
  }, [pathname]);

  // Close mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const rawGroups: AdminGroup[] = isSupportOnly
    ? [
        {
          items: [
            { to: "/admin/tickets", label: "Tickets", end: true, module: "tickets" },
            { to: "/admin/designer", label: "My queue", module: "designer" },
            { to: "/admin/projects/board", label: "Project board", module: "designer" },
          ],
        },
      ]
    : [
        {
          items: [
            { to: "/admin", label: "Dashboard", end: true, module: "dashboard" },
            { to: "/admin/customers", label: "Customers", module: "customers" },
            { to: "/admin/tickets", label: "Tickets", module: "tickets" },
            { to: "/admin/projects", label: "Projects", module: "projects" },
            { to: "/admin/designer", label: "Designer queue", module: "designer" },
            { to: "/admin/projects/board", label: "Project board", module: "designer" },
            { to: "/admin/crm", label: "CRM", module: "crm" },
          ],
        },
        {
          heading: "Catalog",
          items: [
            { to: "/admin/plans", label: "Plans", module: "plans" },
            { to: "/admin/forms", label: "Forms", module: "forms" },
            { to: "/admin/invites", label: "Invites", module: "invites" },
          ],
        },
        {
          heading: "Settings",
          items: [
            { to: "/admin/features", label: "Feature flags", module: "features" },
            { to: "/admin/audit-logs", label: "Audit logs", module: "audit_logs" },
            ...(canManageTeamAccess
              ? [{ to: "/admin/team", label: "Team", module: "users" }]
              : []),
            { to: "/admin/settings/email", label: "Email", module: "email" },
            { to: "/admin/settings/email-templates", label: "Email templates" },
            { to: "/admin/settings/environment", label: "Environment" },
          ],
        },
      ];

  const sidebarBody = (
    <>
      <div className="shrink-0 border-b border-[var(--border-subtle)] px-5 py-4">
        <SxLogo to="/admin" size="sm" />
        <p className="mt-3 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          {isSupportOnly
            ? "Support"
            : user?.role === "master_admin"
              ? "Master admin"
              : "Admin"}
        </p>
        <p className="mt-1 truncate font-ui text-sx-xs text-[var(--text-secondary)]">
          {user?.email}
        </p>
      </div>
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {groups.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {group.heading ? (
              <p className="px-3 pb-1 pt-2 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                {group.heading}
              </p>
            ) : null}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={sideNavClass}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-[var(--border-subtle)] px-5 py-3 text-sx-2xs text-[var(--text-tertiary)]">
        © {new Date().getFullYear()} Sitropix
      </div>
    </>
  );

  return (
    <div
      data-density="compact"
      data-sx-root
      className="min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)]"
    >
      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]/95 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sx-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] lg:hidden"
          >
            <MenuIcon className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <SxLogo to="/admin" size="sm" />
            <span className="hidden font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] sm:inline">
              · {isSupportOnly ? "Support" : "Admin"}
            </span>
          </div>
        </div>
        <AdminProfileMenu />
      </header>

      {/* Mobile drawer scrim */}
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={[
          "fixed bottom-0 left-0 top-14 z-50 flex w-64 flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface-card)]",
          "transition-transform duration-200 ease-out lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        {sidebarBody}
      </aside>

      <main className="pt-14 lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
