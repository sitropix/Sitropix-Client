import type { MaterialIconName } from "@/components/MaterialIcon";
import { MaterialIcon } from "@/components/MaterialIcon";
import { SmartSearch } from "@/components/SmartSearch";
import { PortalOverlay } from "@/components/ui/PortalOverlay";
import { ProjectCreateForm } from "@/components/workspace/ProjectCreateForm";
import { adminHomePath } from "@/lib/adminAccess";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { fetchUiPreferences, patchUiPreferences } from "@/services/authApi";
import { getOnboardingStatusFromProjects } from "@/services/onboardingStore";
import { PROJECTS_LIST_INVALIDATE_EVENT } from "@/services/projectsInvalidate";
import {
  hasValidProjectPlan,
  listProjectsByUser,
} from "@/services/projectsStore";
import type { ProjectRecord } from "@/types/project";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { SxButton } from "@/components/sx/Button";
import { SxLogo } from "@/components/sx/Logo";

const SIDEBAR_LINKS: Array<{
  to: string;
  label: string;
  icon: MaterialIconName;
}> = [
  { to: "/dashboard", label: "Home", icon: "home" },
  { to: "/projects", label: "My Projects", icon: "account_tree" },
  { to: "/tickets", label: "Tickets", icon: "support_agent" },
  { to: "/files", label: "Files", icon: "folder" },
  { to: "/help", label: "Help", icon: "menu_book" },
  { to: "/billing", label: "Billing", icon: "payments" },
  { to: "/plans", label: "Plans", icon: "grid_view" },
];

const ALLOWED_DURING_ONBOARDING = [
  "/dashboard",
  "/subscription",
  "/plans",
  "/projects",
  "/projects/",
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Home",
  "/projects": "My Projects",
  "/subscription-management": "Billing",
  "/billing": "Billing",
  "/subscription": "Plans",
  "/plans": "Plans",
  "/requests": "Tickets",
  "/tickets": "Tickets",
  "/workspace": "Files",
  "/files": "Files",
  "/kb": "Help",
  "/help": "Help",
  "/profile": "Account",
  "/account": "Account",
  "/search": "Search",
  "/client-dashboard": "Home",
  "/ticket": "New ticket",
};

function sidebarNavClass({ isActive }: { isActive: boolean }) {
  return [
    "flex items-center gap-3 rounded-sx-md px-3 py-2 font-ui text-sx-sm font-medium",
    "transition-colors duration-[150ms] ease-[cubic-bezier(0.2,0,0,1)]",
    "outline-none focus-visible:shadow-sx-focus",
    isActive
      ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)] font-semibold"
      : "text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]",
  ].join(" ");
}

function lockedSidebarItemClass() {
  return [
    "flex w-full cursor-not-allowed items-center gap-3 rounded-sx-md px-3 py-2",
    "font-ui text-sx-sm font-medium text-[var(--text-tertiary)] opacity-70",
  ].join(" ");
}

function pageTitleForPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Home";
  const key = `/${segments[0]}`;
  if (PAGE_TITLES[key]) return PAGE_TITLES[key];
  if (pathname.includes("/add-ons/checkout")) return "Review order";
  if (pathname.includes("/add-ons")) return "Manage add-ons";
  if (pathname.endsWith("/plan")) return "Plan";
  if (pathname.startsWith("/projects/")) return "Project";
  if (pathname.startsWith("/files/")) return "Files";
  if (pathname.startsWith("/workspace/")) return "Files";
  if (pathname.startsWith("/support/tickets")) return "Ticket";
  if (pathname.startsWith("/tickets/")) return "Ticket";
  if (pathname.startsWith("/help/")) return "Help";
  if (pathname.startsWith("/ticket")) return "New ticket";
  return "Sitropix";
}

function matchesAllowedPath(target: string, candidate: string): boolean {
  return candidate.endsWith("/")
    ? target.startsWith(candidate)
    : target === candidate || target.startsWith(`${candidate}/`);
}

function SidebarNavItems({
  shouldRestrictNav,
  matchesAllowedPath: pathMatches,
  onNavigate,
}: {
  shouldRestrictNav: boolean;
  matchesAllowedPath: (target: string, candidate: string) => boolean;
  onNavigate?: () => void;
}) {
  const { isAdmin, canAccessAdminPortal, role } = useAuthz();
  const staffPortalPath = adminHomePath(role);

  return (
    <>
      {SIDEBAR_LINKS.map((item) => {
        const locked =
          shouldRestrictNav &&
          !ALLOWED_DURING_ONBOARDING.some((p) => pathMatches(item.to, p));
        if (locked) {
          return (
            <button
              key={item.to}
              type="button"
              disabled
              aria-disabled="true"
              title={`${item.label} is locked until onboarding is complete`}
              className={lockedSidebarItemClass()}
            >
              <MaterialIcon name={item.icon} className="!text-[18px]" />
              <span>{item.label}</span>
              <MaterialIcon
                name="lock"
                className="ml-auto !text-[14px]"
              />
            </button>
          );
        }
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={sidebarNavClass}
            end={item.to === "/dashboard"}
            title={item.label}
            onClick={onNavigate}
          >
            <MaterialIcon name={item.icon} className="!text-[18px]" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
      {canAccessAdminPortal ? (
        <NavLink
          to={staffPortalPath}
          className={sidebarNavClass}
          onClick={onNavigate}
        >
          <MaterialIcon name="settings" className="!text-[18px]" />
          <span>{isAdmin ? "Admin" : "Support"}</span>
        </NavLink>
      ) : null}
    </>
  );
}

function HeaderProfileMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { contact } = useUser();
  const [profileOpen, setProfileOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [profileOpen]);

  const displayName = contact
    ? `${contact.firstName} ${contact.lastName}`.trim()
    : "Customer";
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
        aria-expanded={profileOpen}
        aria-haspopup="menu"
        onClick={() => setProfileOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] font-ui text-sx-xs font-bold text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--border-strong)] focus-visible:shadow-sx-focus"
      >
        <span className="sr-only">Open account menu</span>
        {initials}
      </button>
      {profileOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-[60] mt-2 min-w-[220px] overflow-hidden rounded-sx-md border border-[var(--border-default)] bg-[var(--surface-card)] py-1 shadow-sx-lg"
        >
          <p className="border-b border-[var(--border-subtle)] px-4 py-2.5 font-ui text-sx-xs font-medium text-[var(--text-tertiary)]">
            {displayName}
          </p>
          <Link
            role="menuitem"
            to="/account"
            className="block px-4 py-2 font-ui text-sx-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
            onClick={() => {
              setProfileOpen(false);
              onNavigate?.();
            }}
          >
            Account
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2 text-left font-ui text-sx-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
            onClick={() => {
              setProfileOpen(false);
              onNavigate?.();
              toggleTheme();
            }}
          >
            <MaterialIcon
              name={isDark ? "light_mode" : "dark_mode"}
              className="!text-[16px] text-[var(--text-tertiary)]"
            />
            {isDark ? "Light mode" : "Dark mode"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-4 py-2 text-left font-ui text-sx-sm font-medium text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-bg)]"
            onClick={() => {
              setProfileOpen(false);
              onNavigate?.();
              void logout();
            }}
          >
            Logout
          </button>
        </div>
      ) : null}
    </div>
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

export function ClientPortalShell({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { user, isFirstLogin, logout } = useAuth();
  const { portal } = useUser();

  const [open, setOpen] = useState(false);
  const [showOnboardingPopup, setShowOnboardingPopup] = useState(true);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [onboarding, setOnboarding] = useState({
    hasProject: false,
    hasAssetsReady: false,
    hasActiveSubscription: false,
    completed: false,
  });
  const prevResolvedUserIdRef = useRef<string | null>(null);

  const resolvedUserId = user?.id ?? portal?.user?.id ?? null;

  const projectsKey = useMemo(
    () =>
      projects
        .map(
          (project) =>
            `${project.id}:${project.subscriptionStatus}:${project.planValidUntil ?? ""}`,
        )
        .join("|"),
    [projects],
  );

  const userHasActiveSubscriptionAnywhere = useMemo(
    () => projects.some((project) => hasValidProjectPlan(project)),
    [projects],
  );

  const projectsReady = !projectsLoading;
  const shouldRestrictNav =
    projectsReady &&
    !userHasActiveSubscriptionAnywhere &&
    (isFirstLogin || !onboarding.completed);

  const requiresProjectCreation = !onboarding.hasProject;
  const hideOnboardingPopupOnPaths = [
    "/projects",
    "/projects/",
    "/subscription",
    "/plans",
    "/ticket",
    "/tickets/new",
  ];
  const shouldHideOnboardingPopupForCurrentPath =
    hideOnboardingPopupOnPaths.some((p) => matchesAllowedPath(pathname, p));
  const onboardingPopupVisible =
    projectsReady &&
    shouldRestrictNav &&
    !shouldHideOnboardingPopupForCurrentPath &&
    (requiresProjectCreation || showOnboardingPopup);

  useEffect(() => {
    if (!resolvedUserId) {
      prevResolvedUserIdRef.current = null;
      setProjects([]);
      setProjectsLoading(false);
      return;
    }
    const userSwitched = prevResolvedUserIdRef.current !== resolvedUserId;
    prevResolvedUserIdRef.current = resolvedUserId;
    if (userSwitched) setProjectsLoading(true);

    const forceList =
      search.includes("payment_success=1") ||
      search.includes("payment_success=true");
    let cancelled = false;
    void listProjectsByUser(resolvedUserId, { force: forceList })
      .then((rows) => {
        if (!cancelled) setProjects(rows);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedUserId, pathname, search]);

  useEffect(() => {
    if (!resolvedUserId) return;
    const uid = resolvedUserId;
    function onInvalidate() {
      void listProjectsByUser(uid, { force: true })
        .then((rows) => setProjects(rows))
        .catch(() => setProjects([]));
    }
    window.addEventListener(PROJECTS_LIST_INVALIDATE_EVENT, onInvalidate);
    return () =>
      window.removeEventListener(PROJECTS_LIST_INVALIDATE_EVENT, onInvalidate);
  }, [resolvedUserId]);

  useEffect(() => {
    if (projectsLoading || !resolvedUserId) return;
    let cancelled = false;
    void getOnboardingStatusFromProjects(projects)
      .then((status) => {
        if (!cancelled) setOnboarding(status);
      })
      .catch(() => {
        if (!cancelled) {
          setOnboarding({
            hasProject: projects.length > 0,
            hasAssetsReady: false,
            hasActiveSubscription: projects.some(
              (project) => project.subscriptionStatus === "active",
            ),
            completed: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectsKey, projectsLoading, resolvedUserId]);

  useEffect(() => {
    if (requiresProjectCreation) {
      setShowOnboardingPopup(true);
      return;
    }
    if (!user?.id) return;
    let cancelled = false;
    void fetchUiPreferences()
      .then((payload) => {
        if (cancelled) return;
        const dismissed = payload.uiPrefs?.dismissedOnboardingPopup === true;
        setShowOnboardingPopup(!dismissed);
      })
      .catch(() => {
        if (!cancelled) setShowOnboardingPopup(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, requiresProjectCreation]);

  useEffect(() => {
    if (!onboardingPopupVisible || requiresProjectCreation) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setShowOnboardingPopup(false);
      void patchUiPreferences({ dismissedOnboardingPopup: true }).catch(
        () => {},
      );
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onboardingPopupVisible, requiresProjectCreation]);

  // Close mobile drawer on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function closeMobileNav() {
    setOpen(false);
  }

  const pageTitle = pageTitleForPath(pathname);

  useEffect(() => {
    document.title = `${pageTitle} · Sitropix`;
  }, [pageTitle]);

  const sidebarBody = (
    <>
      <div className="shrink-0 border-b border-[var(--border-subtle)] px-5 py-4">
        <SxLogo to="/dashboard" size="md" onClick={closeMobileNav} />
        <p className="mt-2 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Customer Portal
        </p>
      </div>
      <nav className="min-h-0 min-w-0 flex-1 space-y-0.5 overflow-y-auto overscroll-y-contain p-3">
        <SidebarNavItems
          shouldRestrictNav={shouldRestrictNav}
          matchesAllowedPath={matchesAllowedPath}
          onNavigate={closeMobileNav}
        />
      </nav>
      <div className="shrink-0 space-y-0.5 border-t border-[var(--border-subtle)] p-3">
        <Link
          to="/account"
          onClick={closeMobileNav}
          className={sidebarNavClass({ isActive: false })}
        >
          <MaterialIcon name="settings" className="!text-[18px]" />
          <span>Settings</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            closeMobileNav();
            void logout();
          }}
          className="flex w-full items-center gap-3 rounded-sx-md px-3 py-2 font-ui text-sx-sm font-medium text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-bg)] outline-none focus-visible:shadow-sx-focus"
        >
          <MaterialIcon name="logout" className="!text-[18px]" />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  const sidebarClassName = [
    "fixed inset-y-0 left-0 z-50 flex h-screen w-64 min-w-0 flex-col overflow-x-hidden",
    "border-r border-[var(--border-subtle)] bg-[var(--surface-card)]",
    "transition-transform duration-200 ease-out lg:translate-x-0",
    open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
  ].join(" ");

  return (
    <div
      data-sx-root
      className="client-portal-root min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)]"
    >
      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside className={sidebarClassName}>{sidebarBody}</aside>

      <div className="flex min-h-screen flex-col lg:ml-64">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sx-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] lg:hidden"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <MenuIcon className="h-4 w-4" />
            </button>
            <h1 className="truncate font-ui text-sx-md font-semibold text-[var(--text-primary)]">
              {pageTitle}
            </h1>
          </div>

          <div className="hidden min-w-0 flex-1 px-4 md:block lg:max-w-md">
            <SmartSearch compact variant="portal" />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link to="/tickets/new" onClick={closeMobileNav} className="hidden sm:block">
              <SxButton variant="primary" size="sm">
                + New ticket
              </SxButton>
            </Link>
            <Link
              to="/tickets/new"
              onClick={closeMobileNav}
              aria-label="New ticket"
              className="inline-flex h-9 w-9 items-center justify-center rounded-sx-md bg-[var(--color-brand-500)] text-white hover:bg-[var(--color-brand-600)] sm:hidden"
            >
              <MaterialIcon name="add" className="!text-[18px]" />
            </Link>
            <HeaderProfileMenu onNavigate={closeMobileNav} />
          </div>
        </header>

        <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2 md:hidden">
          <SmartSearch compact variant="portal" />
        </div>

        <main className="relative flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>

          <PortalOverlay
            open={onboardingPopupVisible}
            onClose={
              requiresProjectCreation
                ? undefined
                : () => {
                    setShowOnboardingPopup(false);
                    void patchUiPreferences({
                      dismissedOnboardingPopup: true,
                    }).catch(() => {});
                  }
            }
            className="fixed inset-0 grid place-items-center bg-black/55 p-4 backdrop-blur-[2px]"
          >
            <div
              role="dialog"
              aria-modal
              aria-labelledby="onboarding-dialog-title"
              className="flex max-h-[min(90dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-sx-xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-sx-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 justify-end px-5 pb-0 pt-4">
                {!requiresProjectCreation ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowOnboardingPopup(false);
                      void patchUiPreferences({
                        dismissedOnboardingPopup: true,
                      }).catch(() => {});
                    }}
                    className="grid h-7 w-7 place-items-center rounded-full border border-[var(--border-default)] text-[var(--text-tertiary)] hover:bg-[var(--surface-sunken)]"
                    aria-label="Close popup"
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">
                <h3
                  id="onboarding-dialog-title"
                  className="font-display text-sx-lg font-semibold text-[var(--text-primary)]"
                >
                  {requiresProjectCreation
                    ? "Create your first project"
                    : "Finish onboarding to unlock everything"}
                </h3>
                <p className="mt-2 text-sx-sm text-[var(--text-secondary)]">
                  {requiresProjectCreation
                    ? "Add a project below. Then upload assets and pick a plan."
                    : "Finish these steps, then continue to plans and payment."}
                </p>
                {requiresProjectCreation ? (
                  <div className="mt-4">
                    <ProjectCreateForm
                      layout="stacked"
                      autoFocusName
                      onCreated={(created) => {
                        closeMobileNav();
                        navigate(`/projects/${created.id}`);
                      }}
                    />
                  </div>
                ) : null}
                <ul className="mt-4 flex flex-col gap-2 text-sx-sm">
                  <li className="rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-[var(--text-secondary)]">
                    {onboarding.hasProject ? "✓ Done" : "Pending"} — Create your first project
                  </li>
                  <li className="rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-[var(--text-secondary)]">
                    {onboarding.hasAssetsReady ? "✓ Done" : "Pending"} — Upload required assets
                  </li>
                  <li className="rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-[var(--text-secondary)]">
                    {onboarding.hasActiveSubscription ? "✓ Done" : "Pending"} — Choose plan and complete payment
                  </li>
                </ul>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-5 py-4">
                <Link to="/projects" onClick={closeMobileNav}>
                  <SxButton variant="secondary" size="sm">
                    My projects
                  </SxButton>
                </Link>
                <Link to="/plans" onClick={closeMobileNav}>
                  <SxButton
                    variant="primary"
                    size="sm"
                    disabled={requiresProjectCreation}
                  >
                    Continue to plans
                  </SxButton>
                </Link>
              </div>
            </div>
          </PortalOverlay>
        </main>
      </div>
    </div>
  );
}
