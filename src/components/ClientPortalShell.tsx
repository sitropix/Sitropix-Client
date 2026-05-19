import { MaterialIcon } from "@/components/MaterialIcon";
import type { MaterialIconName } from "@/components/MaterialIcon";
import { SmartSearch } from "@/components/SmartSearch";
import { PortalOverlay } from "@/components/ui/PortalOverlay";
import { ProjectCreateForm } from "@/components/workspace/ProjectCreateForm";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { fetchUiPreferences, patchUiPreferences } from "@/services/authApi";
import { getOnboardingStatusFromProjects } from "@/services/onboardingStore";
import {
  hasValidProjectPlan,
  listProjectsByUser,
} from "@/services/projectsStore";
import { PROJECTS_LIST_INVALIDATE_EVENT } from "@/services/projectsInvalidate";
import type { Plan } from "@/types/subscription";
import type { ProjectRecord } from "@/types/project";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

const SIDEBAR_LINKS: Array<{
  to: string;
  label: string;
  icon: MaterialIconName;
}> = [
  { to: "/dashboard", label: "Home", icon: "home" },
  { to: "/projects", label: "My Projects", icon: "account_tree" },
  { to: "/subscription-management", label: "Payments", icon: "payments" },
  { to: "/subscription", label: "Plan Catalog", icon: "grid_view" },
  { to: "/requests", label: "Support", icon: "support_agent" },
  { to: "/workspace", label: "Files", icon: "folder" },
  { to: "/kb", label: "Knowledge Base", icon: "menu_book" },
];

const ALLOWED_DURING_ONBOARDING = [
  "/dashboard",
  "/subscription",
  "/projects",
  "/projects/",
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projects": "My Projects",
  "/subscription-management": "Payments",
  "/subscription": "Plan Catalog",
  "/requests": "Support",
  "/workspace": "Files",
  "/kb": "Knowledge Base",
  "/profile": "Settings",
  "/search": "Search",
  "/billing": "Billing",
  "/client-dashboard": "Dashboard",
  "/ticket": "Ticket",
};

function sidebarNavClass({ isActive }: { isActive: boolean }) {
  return [
    "portal-nav-link flex items-center gap-4 bg-transparent py-3 px-4 font-body text-body text-white transition-colors duration-200 ease-in-out",
    isActive
      ? "portal-nav-link--active border-l-2 border-accent-gold font-semibold"
      : "border-l-2 border-transparent",
  ].join(" ");
}

function lockedSidebarClass() {
  return "flex w-full cursor-not-allowed items-center gap-4 border-l-2 border-transparent py-3 px-4 text-left font-body text-body text-white/40";
}

function pageTitleForPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Dashboard";
  const key = `/${segments[0]}`;
  if (PAGE_TITLES[key]) return PAGE_TITLES[key];
  if (pathname.includes("/add-ons")) return "Manage Add-ons";
  if (pathname.startsWith("/projects/")) return "My Projects";
  if (pathname.startsWith("/workspace/")) return "Files";
  if (pathname.startsWith("/support/tickets")) return "Support";
  if (pathname.startsWith("/ticket")) return "Ticket";
  return "Client Portal";
}

function matchesAllowedPath(target: string, candidate: string): boolean {
  return candidate.endsWith("/")
    ? target.startsWith(candidate)
    : target === candidate || target.startsWith(`${candidate}/`);
}

function PortalSidebarBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/dashboard"
      onClick={onNavigate}
      className="mb-10 block px-2 outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50"
    >
      <h1 className="flex items-center gap-1 font-h1 text-h2 font-bold leading-none text-accent-gold">
        Sitropix
        <span
          className="inline-block h-2 w-2 translate-y-1 rounded-full bg-accent-gold"
          aria-hidden
        />
      </h1>
      <p className="mt-1 font-caption text-caption uppercase tracking-wider text-white/55">
        Client Portal
      </p>
    </Link>
  );
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
  const { isAdmin } = useAuthz();

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
              className={lockedSidebarClass()}
            >
              <MaterialIcon
                name={item.icon}
                className="!text-[22px] text-white/40"
              />
              <span>{item.label}</span>
              <MaterialIcon name="lock" className="ml-auto !text-[18px]" />
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
            <MaterialIcon name={item.icon} className="!text-[22px]" />
            <span className="font-body text-body">{item.label}</span>
          </NavLink>
        );
      })}
      {isAdmin ? (
        <NavLink to="/admin" className={sidebarNavClass} onClick={onNavigate}>
          <MaterialIcon name="settings" className="!text-[22px]" />
          <span className="font-body text-body">Admin</span>
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
        className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-low font-body text-xs font-bold text-on-surface shadow-sm outline-none transition hover:border-accent-gold/40 focus-visible:ring-2 focus-visible:ring-accent-gold/35"
      >
        <span className="sr-only">Open account menu</span>
        {initials}
      </button>
      {profileOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-[60] mt-2 min-w-[220px] overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest py-1.5 shadow-glass ring-1 ring-black/5"
        >
          <p className="border-b border-outline-variant/30 px-4 py-2.5 text-xs font-medium text-on-surface-variant">
            {displayName}
          </p>
          <Link
            role="menuitem"
            to="/profile"
            className="block px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container"
            onClick={() => {
              setProfileOpen(false);
              onNavigate?.();
            }}
          >
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-on-surface hover:bg-surface-container"
            onClick={() => {
              setProfileOpen(false);
              onNavigate?.();
              toggleTheme();
            }}
          >
            <MaterialIcon
              name={isDark ? "light_mode" : "dark_mode"}
              className="!text-[20px] text-on-surface-variant"
            />
            {isDark ? "Light mode" : "Dark mode"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-4 py-2.5 text-left text-sm font-medium text-error hover:bg-error-bg"
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

export function ClientPortalShell({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { user, isFirstLogin, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
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

  const sortedPlans: Plan[] = useMemo(() => {
    const raw = portal?.plans ?? [];
    return [...raw].sort((a, b) => a.priceMonthlyCents - b.priceMonthlyCents);
  }, [portal?.plans]);

  const highestPlanTier = useMemo(() => {
    const owned = projects.filter(hasValidProjectPlan);
    if (owned.length === 0) return -1;
    let max = -1;
    for (const p of owned) {
      const idx = sortedPlans.findIndex((pl) => pl.id === p.planId);
      if (idx > max) max = idx;
    }
    return max;
  }, [projects, sortedPlans]);

  const nextPlan = useMemo((): Plan | null => {
    if (sortedPlans.length === 0) return null;
    if (highestPlanTier < 0) return sortedPlans[0] ?? null;
    if (highestPlanTier >= sortedPlans.length - 1) return null;
    return sortedPlans[highestPlanTier + 1] ?? null;
  }, [highestPlanTier, sortedPlans]);

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
    "/ticket",
  ];
  const shouldHideOnboardingPopupForCurrentPath = hideOnboardingPopupOnPaths.some(
    (p) => matchesAllowedPath(pathname, p),
  );
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

  function closeMobileNav() {
    setOpen(false);
  }

  const pageTitle = pageTitleForPath(pathname);

  const sidebarNav = (
    <>
      <PortalSidebarBrand onNavigate={closeMobileNav} />
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <SidebarNavItems
          shouldRestrictNav={shouldRestrictNav}
          matchesAllowedPath={matchesAllowedPath}
          onNavigate={closeMobileNav}
        />
      </nav>
      <div className="mt-auto space-y-4 border-t border-white/10 pt-6">
        {nextPlan ? (
          <Link
            to="/subscription"
            onClick={closeMobileNav}
            className="flex w-full items-center justify-center rounded-lg bg-accent-gold py-3 font-body font-semibold text-stone-6 outline-none transition-opacity duration-200 hover:opacity-90 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent-gold/40"
          >
            Upgrade Plan
          </Link>
        ) : null}
        <div className="space-y-1">
          <Link
            to="/profile"
            onClick={closeMobileNav}
            className="flex items-center gap-4 bg-transparent py-3 px-4 font-body text-body text-white transition-colors duration-200 ease-in-out hover:text-white"
          >
            <MaterialIcon name="settings" className="!text-[22px]" />
            Settings
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-4 bg-transparent py-3 px-4 text-left font-body text-body text-white transition-colors duration-200 ease-in-out hover:text-white"
            onClick={() => {
              closeMobileNav();
              void logout();
            }}
          >
            <MaterialIcon name="logout" className="!text-[22px]" />
            Logout
          </button>
        </div>
      </div>
    </>
  );

  const sidebarClassName = [
    "portal-sidebar fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-white/10 bg-black px-4 py-6 text-white shadow-xl",
    "transition-transform duration-200 ease-out md:translate-x-0",
    open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
  ].join(" ");

  return (
    <div className="client-portal-root min-h-screen bg-background text-on-background">
      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside className={sidebarClassName}>
        {sidebarNav}
      </aside>

      <div className="client-portal-canvas flex min-h-screen flex-col bg-background md:ml-64">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-outline-variant/10 bg-surface/85 px-gutter shadow-sm backdrop-blur-md">
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant/50 bg-surface-container-lowest text-on-surface outline-none transition hover:bg-surface-container md:hidden"
            aria-label="Open navigation"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <MaterialIcon name="menu" className="!text-[24px]" />
          </button>

          <h1 className="hidden shrink-0 font-h2 text-h2 text-on-surface md:block">
            {pageTitle}
          </h1>
          <h1 className="shrink-0 font-h2 text-h2 text-on-surface md:hidden">
            {pageTitle}
          </h1>

          <div className="hidden min-w-0 flex-1 md:block lg:max-w-xl">
            <SmartSearch compact variant="portal" />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              aria-label="Notifications"
              className="rounded-full p-2 text-on-surface-variant outline-none transition-colors hover:bg-on-surface/5"
            >
              <MaterialIcon name="notifications" className="!text-[22px]" />
            </button>

            <button
              type="button"
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-on-surface-variant outline-none hover:bg-surface-container"
              onClick={() => toggleTheme()}
            >
              <MaterialIcon
                name={isDark ? "light_mode" : "dark_mode"}
                className="!text-[22px]"
              />
            </button>

            <Link
              to="/requests"
              className="portal-btn-secondary hidden items-center gap-1 !rounded-lg !border-on-surface/15 !bg-surface-container-lowest !px-3 !py-2 !text-sm !font-semibold !text-on-surface hover:!bg-surface-container xl:inline-flex"
              onClick={closeMobileNav}
            >
              <MaterialIcon name="support_agent" className="!text-[20px]" />
              Support
            </Link>

            <Link
              to="/projects#new-project"
              className="portal-btn-dark hidden items-center gap-2 rounded-lg bg-on-surface px-4 py-2 font-body font-medium text-surface transition-all hover:opacity-90 active:opacity-80 sm:inline-flex"
              onClick={closeMobileNav}
            >
              <MaterialIcon name="add" className="!text-[20px]" />
              New Project
            </Link>

            <HeaderProfileMenu onNavigate={closeMobileNav} />
          </div>
        </header>

        <div className="border-b border-outline-variant/35 px-3 py-2 md:hidden">
          <SmartSearch compact variant="portal" />
        </div>

        <main className="client-portal-main relative flex-1 p-8">
          <div
            className={
              false ? "pointer-events-none select-none blur-[3px]" : ""
            }
          >
            <div className="portal-page mx-auto w-full max-w-6xl space-y-8">
              {children}
            </div>
          </div>
          <PortalOverlay
            open={onboardingPopupVisible}
            onClose={
              requiresProjectCreation
                ? undefined
                : () => {
                    setShowOnboardingPopup(false);
                    void patchUiPreferences({ dismissedOnboardingPopup: true }).catch(() => {});
                  }
            }
            className="fixed inset-0 grid place-items-center bg-black/70 p-4 backdrop-blur-[2px]"
          >
              <div
                role="dialog"
                aria-modal
                aria-labelledby="onboarding-dialog-title"
                className="flex max-h-[min(90dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-on-surface/10 bg-surface-container-lowest text-on-surface shadow-2xl"
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
                      className="grid h-7 w-7 place-items-center rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container"
                      aria-label="Close popup"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">
                <h3 id="onboarding-dialog-title" className="font-h3 text-h3 font-bold text-on-surface">
                  {requiresProjectCreation
                    ? "Create your first project"
                    : "Complete onboarding to unlock all pages"}
                </h3>
                <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
                  {requiresProjectCreation
                    ? "Add a project below, then upload assets and choose a plan."
                    : "Finish these steps, then continue to subscription and payment."}
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
                <ul className="mt-4 space-y-2 font-body-sm text-body-sm">
                  <li className="rounded-xl border border-on-surface/10 bg-surface-container-lowest px-3 py-2">
                    {onboarding.hasProject ? "Done" : "Pending"} — Create your first project
                  </li>
                  <li className="rounded-xl border border-on-surface/10 bg-surface-container-lowest px-3 py-2">
                    {onboarding.hasAssetsReady ? "Done" : "Pending"} — Upload required project assets
                  </li>
                  <li className="rounded-xl border border-on-surface/10 bg-surface-container-lowest px-3 py-2">
                    {onboarding.hasActiveSubscription ? "Done" : "Pending"} — Choose plan/add-on and complete payment
                  </li>
                </ul>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 border-t border-on-surface/10 bg-surface-container-lowest px-5 py-4">
                  <Link
                    to="/projects"
                    className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 font-body text-body font-semibold text-on-surface"
                    onClick={closeMobileNav}
                  >
                    Open My Projects
                  </Link>
                  <Link
                    to="/subscription"
                    className={`rounded-lg px-3 py-2 font-body text-body font-semibold ${
                      requiresProjectCreation
                        ? "pointer-events-none bg-surface-container text-on-surface-variant"
                        : "bg-on-surface text-surface"
                    }`}
                    onClick={closeMobileNav}
                  >
                    Continue to Subscription
                  </Link>
                </div>
              </div>
          </PortalOverlay>
        </main>
      </div>
    </div>
  );
}

