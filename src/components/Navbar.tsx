import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { SmartSearch } from "@/components/SmartSearch";
import { useAuthz } from "@/context/AuthzContext";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-lg px-3 py-2 text-sm font-medium transition",
    isActive
      ? "bg-white/10 text-white shadow-inner"
      : "text-ink-muted hover:bg-white/[0.06] hover:text-white",
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
        className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-semibold text-brand-lime outline-none ring-brand-lime/30 focus-visible:ring-2"
      >
        <span className="sr-only">Account menu</span>
        {initials}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[60] mt-2 min-w-[180px] rounded-xl border border-white/10 bg-[#15191c] py-1 shadow-xl"
        >
          <Link
            role="menuitem"
            to="/profile"
            className="block px-4 py-2.5 text-sm text-white hover:bg-white/[0.06]"
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
            className="w-full px-4 py-2.5 text-left text-sm text-ink-muted hover:bg-white/[0.06] hover:text-white"
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
  const { logout, isAuthenticated } = useAuth();
  const { isAdmin } = useAuthz();
  const [open, setOpen] = useState(false);
  const isHomeScreen = pathname === "/";

  const displayName = loading
    ? "…"
    : contact
      ? `${contact.firstName} ${contact.lastName}`.trim() || "Account"
      : "Account";

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-canvas/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="shrink-0 rounded-xl outline-none ring-brand-lime/40 focus-visible:ring-2">
          <Logo />
        </Link>

        {!isAuthenticated && (
          <div className="hidden min-w-0 max-w-md flex-1 px-2 md:block">
            <SmartSearch compact />
          </div>
        )}

        <nav className="hidden min-w-0 items-center gap-1 md:flex" aria-label="Primary">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          {isAuthenticated && !isAdmin && (
            <>
              <NavLink to="/subscription-management" className={navLinkClass}>
                Subscription Management
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
                  <NavLink to="/dashboard" className={navLinkClass}>
                    Subscription
                  </NavLink>
                  <NavLink to="/workspace" className={navLinkClass}>
                    Workspace
                  </NavLink>
                </>
              )}
            </>
          )}
          {isAuthenticated && isAdmin && (
            <NavLink to="/admin" className={navLinkClass}>
              Admin
            </NavLink>
          )}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 md:flex">
          {!isAuthenticated && (
            <>
              <NavLink
                to="/login"
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-brand-lime/35 hover:text-white"
              >
                Sign in
              </NavLink>
              <NavLink
                to="/signup"
                className="rounded-full bg-brand-lime px-3 py-1.5 text-xs font-semibold text-canvas transition hover:bg-brand-lime-dim"
              >
                Sign up
              </NavLink>
            </>
          )}
          {isAuthenticated && !isAdmin && (
            <>
              <span className="max-w-[160px] truncate text-right text-sm font-medium text-white" title={displayName}>
                {displayName}
              </span>
              <ProfileMenu />
            </>
          )}
          {isAuthenticated && isAdmin && (
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-brand-lime/35 hover:text-white"
            >
              Sign out
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {isAuthenticated && !isAdmin && (
            <>
              <span className="max-w-[120px] truncate text-right text-xs font-medium text-white">{displayName}</span>
              <ProfileMenu onNavigate={() => setOpen(false)} />
            </>
          )}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white"
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
          className="border-t border-white/10 bg-canvas/95 px-4 py-4 backdrop-blur-xl md:hidden"
        >
          {!isAuthenticated && (
            <div className="mb-4">
              <SmartSearch compact />
            </div>
          )}
          <nav className="flex flex-col gap-1" aria-label="Mobile primary">
            <NavLink to="/" end className={navLinkClass} onClick={() => setOpen(false)}>
              Home
            </NavLink>
            {isAuthenticated && (
              <>
                {!isAdmin && (
                  <>
                    <NavLink to="/subscription-management" className={navLinkClass} onClick={() => setOpen(false)}>
                      Subscription Management
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
                        <NavLink to="/dashboard" className={navLinkClass} onClick={() => setOpen(false)}>
                          Subscription
                        </NavLink>
                        <NavLink to="/workspace" className={navLinkClass} onClick={() => setOpen(false)}>
                          Workspace
                        </NavLink>
                      </>
                    )}
                    <button
                      type="button"
                      className="rounded-lg px-3 py-2 text-left text-sm text-ink-muted hover:bg-white/[0.06] hover:text-white"
                      onClick={() => {
                        setOpen(false);
                        void logout();
                      }}
                    >
                      Logout
                    </button>
                  </>
                )}
                {isAdmin && (
                  <NavLink to="/admin" className={navLinkClass} onClick={() => setOpen(false)}>
                    Admin
                  </NavLink>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm text-ink-muted"
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
