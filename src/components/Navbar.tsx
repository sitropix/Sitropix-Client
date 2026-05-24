import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { SmartSearch } from "@/components/SmartSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { adminHomePath } from "@/lib/adminAccess";
import { useAuthz } from "@/context/AuthzContext";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-lg px-3 py-2 text-sm font-medium transition",
    isActive
      ? "bg-zinc-100 text-zinc-900"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  ].join(" ");

function ProfileMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { logout } = useAuth();
  const { contact } = useUser();
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

  const initials =
    `${contact?.firstName?.charAt(0) ?? ""}${contact?.lastName?.charAt(0) ?? ""}`.trim() || "?";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-800 outline-none ring-zinc-400/40 transition hover:bg-zinc-100 focus-visible:ring-2"
      >
        <span className="sr-only">Account menu</span>
        {initials}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[60] mt-2 min-w-[180px] rounded-xl border border-zinc-200 bg-white py-1 shadow-glass"
        >
          <Link
            role="menuitem"
            to="/profile"
            className="block px-4 py-2.5 text-sm text-zinc-800 hover:bg-zinc-100"
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
            className="w-full px-4 py-2.5 text-left text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
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

export function Navbar() {
  const { pathname } = useLocation();
  const { contact, loading } = useUser();
  const { logout, isAuthenticated, loading: authLoading } = useAuth();
  const { isAdmin, canAccessAdminPortal, role } = useAuthz();
  const staffPortalPath = adminHomePath(role);
  const [open, setOpen] = useState(false);
  const isHomeScreen = pathname === "/";
  const isPublicLanding = isHomeScreen && !isAuthenticated && !authLoading;

  const displayName = loading
    ? "…"
    : contact
      ? `${contact.firstName} ${contact.lastName}`.trim() || "Account"
      : "Account";

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="shrink-0 rounded-xl outline-none ring-zinc-400/40 focus-visible:ring-2"
        >
          <Logo />
        </Link>

        {!isAuthenticated && !isPublicLanding && (
          <div className="hidden min-w-0 max-w-md flex-1 px-2 md:block">
            <SmartSearch compact />
          </div>
        )}

        <nav
          className="hidden min-w-0 flex-1 items-center justify-end gap-1 md:flex"
          aria-label="Primary"
        >
          {!isPublicLanding && (
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
          )}
          {isAuthenticated && !isAdmin && (
            <>
              <NavLink to="/subscription-management" className={navLinkClass}>
                Subscription
              </NavLink>
              {!isHomeScreen && (
                <>
                  <NavLink to="/requests" className={navLinkClass}>
                    My Requests
                  </NavLink>
                  <NavLink to="/kb" className={navLinkClass}>
                    Knowledge Base
                  </NavLink>
                  <NavLink to="/community" className={navLinkClass}>
                    Community
                  </NavLink>
                  <NavLink to="/projects" className={navLinkClass}>
                    Projects
                  </NavLink>
                  <NavLink to="/workspace" className={navLinkClass}>
                    Workspace
                  </NavLink>
                </>
              )}
            </>
          )}
          {isAuthenticated && canAccessAdminPortal && (
            <NavLink to={staffPortalPath} className={navLinkClass}>
              {isAdmin ? "Admin" : "Support"}
            </NavLink>
          )}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <ThemeToggle />
          {!isAuthenticated && (
            <>
              <NavLink
                to="/login"
                className="rounded-full px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:text-zinc-900"
              >
                Sign in
              </NavLink>
              <NavLink
                to="/signup"
                className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Sign up
              </NavLink>
            </>
          )}
          {isAuthenticated && !isAdmin && (
            <>
              <span
                className="ml-1 max-w-[160px] truncate text-right text-sm font-medium text-zinc-800"
                title={displayName}
              >
                {displayName}
              </span>
              <ProfileMenu />
            </>
          )}
          {isAuthenticated && canAccessAdminPortal && (
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
            >
              Sign out
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle compact />
          {isAuthenticated && !isAdmin && (
            <ProfileMenu onNavigate={() => setOpen(false)} />
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-800"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-nav"
          className="border-t border-zinc-200 bg-white px-4 py-4 md:hidden"
        >
          {!isAuthenticated && !isPublicLanding && (
            <div className="mb-4">
              <SmartSearch compact />
            </div>
          )}
          <nav className="flex flex-col gap-1" aria-label="Mobile primary">
            {!isPublicLanding && (
              <NavLink to="/" end className={navLinkClass} onClick={() => setOpen(false)}>
                Home
              </NavLink>
            )}
            {isAuthenticated && (
              <>
                {!isAdmin && (
                  <>
                    <NavLink to="/subscription-management" className={navLinkClass} onClick={() => setOpen(false)}>
                      Subscription
                    </NavLink>
                    {!isHomeScreen && (
                      <>
                        <NavLink to="/requests" className={navLinkClass} onClick={() => setOpen(false)}>
                          My Requests
                        </NavLink>
                        <NavLink to="/kb" className={navLinkClass} onClick={() => setOpen(false)}>
                          Knowledge Base
                        </NavLink>
                        <NavLink to="/community" className={navLinkClass} onClick={() => setOpen(false)}>
                          Community
                        </NavLink>
                        <NavLink to="/projects" className={navLinkClass} onClick={() => setOpen(false)}>
                          Projects
                        </NavLink>
                        <NavLink to="/workspace" className={navLinkClass} onClick={() => setOpen(false)}>
                          Workspace
                        </NavLink>
                      </>
                    )}
                    <button
                      type="button"
                      className="rounded-lg px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                      onClick={() => {
                        setOpen(false);
                        void logout();
                      }}
                    >
                      Logout
                    </button>
                  </>
                )}
                {canAccessAdminPortal && (
                  <NavLink to={staffPortalPath} className={navLinkClass} onClick={() => setOpen(false)}>
                    {isAdmin ? "Admin" : "Support"}
                  </NavLink>
                )}
                {canAccessAdminPortal && (
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    onClick={() => {
                      setOpen(false);
                      void logout();
                    }}
                  >
                    Sign out
                  </button>
                )}
              </>
            )}
            {!isAuthenticated && (
              <>
                <NavLink to="/login" className={navLinkClass} onClick={() => setOpen(false)}>
                  Sign in
                </NavLink>
                <NavLink to="/signup" className={navLinkClass} onClick={() => setOpen(false)}>
                  Sign up
                </NavLink>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
