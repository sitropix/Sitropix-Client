import { Logo } from "@/components/Logo";
import { SmartSearch } from "@/components/SmartSearch";
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
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

const portalLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "portal-nav-link flex items-center justify-between gap-2 rounded-lg border-l-2 py-2.5 pl-2.5 pr-3 text-sm font-medium transition",
    isActive
      ? "border-l-brand-lime bg-white text-zinc-900 shadow-[inset_0_0_0_1px_rgba(112,111,112,0.2)]"
      : "border-l-transparent text-zinc-600 hover:border-l-zinc-300 hover:bg-white/70 hover:text-zinc-900",
  ].join(" ");

const lockedPortalLinkClass =
  "portal-nav-link flex cursor-not-allowed items-center justify-between gap-2 rounded-lg border-l-2 border-l-transparent bg-zinc-100/80 py-2.5 pl-2.5 pr-3 text-sm font-medium text-zinc-500 opacity-80";

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

function LockIcon({ className }: { className?: string }) {
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
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 118 0v3" />
    </svg>
  );
}

function ThemeToggleIcon({ dark }: { dark: boolean }) {
  if (dark) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path d="M12 3v1.5M12 19.5V21M4.5 12H3m18 0h-1.5M6.22 6.22l-1.06-1.06m13.62 13.62-1.06-1.06M17.78 6.22l1.06-1.06M6.22 17.78l-1.06 1.06" />
        <circle cx="12" cy="12" r="4.25" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
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

  const displayName = contact
    ? `${contact.firstName} ${contact.lastName}`.trim()
    : "Customer";
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
            <p className="truncate text-sm font-semibold text-zinc-900">
              {displayName}
            </p>
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
  const [showOnboardingPopup, setShowOnboardingPopup] = useState(true);
  const [projects, setProjects] = useState<
    Awaited<ReturnType<typeof listProjectsByUser>>
  >([]);
  const [onboarding, setOnboarding] = useState({
    hasProject: false,
    hasAssetsReady: false,
    hasActiveSubscription: false,
    completed: false,
  });
  const { pathname } = useLocation();
  const { isFirstLogin, user } = useAuth();
  const { isAdmin } = useAuthz();
  const { isDark, toggleTheme } = useTheme();
  const { portal } = useUser();
  const userId = user?.id ?? portal?.user?.id ?? "guest-user";
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
  const allowedDuringOnboarding = [
    "/dashboard",
    "/subscription",
    "/projects",
    "/projects/",
  ];
  const matchesAllowedPath = (target: string, candidate: string) =>
    candidate.endsWith("/")
      ? target.startsWith(candidate)
      : target === candidate || target.startsWith(`${candidate}/`);
  const userHasActiveSubscriptionAnywhere = useMemo(
    () => projects.some((project) => hasValidProjectPlan(project)),
    [projects],
  );
  const shouldLockByFirstLogin = isFirstLogin;
  const shouldRestrictNav =
    !userHasActiveSubscriptionAnywhere &&
    (shouldLockByFirstLogin || !onboarding.completed);
  useEffect(() => {
    let cancelled = false;
    void listProjectsByUser(userId)
      .then((rows) => {
        if (!cancelled) setProjects(rows);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const requiresProjectCreation = !onboarding.hasProject;
  const hideOnboardingPopupOnPaths = ["/projects", "/projects/", "/subscription"];
  const shouldHideOnboardingPopupForCurrentPath =
    hideOnboardingPopupOnPaths.some((p) => matchesAllowedPath(pathname, p));
  const onboardingPopupVisible =
    shouldRestrictNav &&
    !shouldHideOnboardingPopupForCurrentPath &&
    (requiresProjectCreation || showOnboardingPopup);

  useEffect(() => {
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
  }, [projectsKey]);

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

  const sortedPlans = [...(portal?.plans ?? [])].sort(
    (a, b) => a.priceMonthlyCents - b.priceMonthlyCents,
  );
  const currentProject = projects.find(
    (project) => project.subscriptionStatus === "active",
  );
  const currentPlanId = currentProject?.planId ?? null;
  const currentIdx =
    currentPlanId != null
      ? sortedPlans.findIndex((p) => p.id === currentPlanId)
      : -1;
  const nextPlan =
    currentIdx >= 0 && currentIdx < sortedPlans.length - 1
      ? sortedPlans[currentIdx + 1]
      : null;

  const links = [
    { to: "/dashboard", label: "Home" },
    { to: "/projects", label: "My Projects" },
    {
      to: "/subscription-management",
      label: "Payment Management",
    },
    { to: "/subscription", label: "Plans & Add-Ons" },
    { to: "/requests", label: "Support" },
    { to: "/workspace", label: "Workspace Files" },
    { to: "/kb", label: "Knowledge Base" },
  ];

  return (
    <div className="client-portal-root min-h-screen bg-[#ebedf1] text-zinc-900">
      <aside className="portal-sidebar fixed left-0 top-0 z-50 hidden h-full w-[260px] flex-col border-r border-zinc-300 bg-[#d4d8df] shadow-[inset_-1px_0_0_rgba(112,111,112,0.18),6px_0_24px_rgba(53,53,54,0.15)] lg:flex">
        <div className="shrink-0 flex h-14 items-center border-b border-zinc-300 bg-white/40 px-5">
          <Link
            to="/dashboard"
            className="inline-flex rounded-xl outline-none ring-zinc-400 transition hover:bg-white/60 focus-visible:ring-2"
          >
            <Logo />
          </Link>
        </div>

        <nav
          className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-4"
          aria-label="Portal navigation"
        >
          <div className="portal-sidebar-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white/70">
            <div className="portal-sidebar-header shrink-0 border-b border-zinc-300 bg-white/70 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Workspace
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              <div className="space-y-0.5">
                {links.map((item) => {
                  const locked =
                    shouldRestrictNav &&
                    !allowedDuringOnboarding.some((p) =>
                      matchesAllowedPath(item.to, p),
                    );
                  if (locked) {
                    return (
                      <button
                        key={item.to}
                        type="button"
                        disabled
                        aria-disabled="true"
                        title={`${item.label} is locked until onboarding is complete`}
                        className={lockedPortalLinkClass}
                      >
                        <span className="min-w-0 truncate">{item.label}</span>
                        <span className="inline-flex items-center gap-1 text-zinc-500">
                          <LockIcon className="h-3.5 w-3.5 shrink-0" />
                        </span>
                      </button>
                    );
                  }
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={portalLinkClass}
                      end={item.to === "/dashboard"}
                      title={item.label}
                    >
                      <span className="min-w-0 truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
              {isAdmin ? (
                <>
                  <div
                    className="my-2 border-t border-zinc-300"
                    role="presentation"
                  />
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Workspace
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-2">
                {links.map((item) => {
                  const locked =
                    shouldRestrictNav &&
                    !allowedDuringOnboarding.some((p) =>
                      matchesAllowedPath(item.to, p),
                    );
                  if (locked) {
                    return (
                      <button
                        key={item.to}
                        type="button"
                        disabled
                        aria-disabled="true"
                        title={`${item.label} is locked until onboarding is complete`}
                        className={lockedPortalLinkClass}
                      >
                        <span className="min-w-0 truncate">{item.label}</span>
                        <span className="inline-flex items-center gap-1 text-zinc-500">
                          <LockIcon className="h-3.5 w-3.5 shrink-0" />
                        </span>
                      </button>
                    );
                  }
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={portalLinkClass}
                      end={item.to === "/dashboard"}
                      title={item.label}
                      onClick={(_e) => {
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
                {isAdmin && (
                  <NavLink
                    to="/admin"
                    className={portalLinkClass}
                    onClick={() => setOpen(false)}
                  >
                    <span className="min-w-0 truncate">Admin</span>
                  </NavLink>
                )}
              </div>
            </div>
            {nextPlan && (
              <div className="mt-3">
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Upgrade
                </p>
                <div className="rounded-xl border border-zinc-300 bg-white p-3">
                  <p className="text-xs font-semibold text-zinc-900">
                    Upgrade to {nextPlan.name}
                  </p>
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

        <main className="client-portal-main relative bg-[#ebedf1] px-4 py-6 lg:px-8 lg:py-8">
          <div
            className={
              onboardingPopupVisible
                ? "pointer-events-none select-none blur-[3px]"
                : ""
            }
          >
            {children}
          </div>
          {onboardingPopupVisible ? (
            <div
              className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-[2px]"
              onClick={() => {
                if (requiresProjectCreation) return;
                setShowOnboardingPopup(false);
                void patchUiPreferences({
                  dismissedOnboardingPopup: true,
                }).catch(() => {});
              }}
            >
              <div
                className="w-full max-w-md rounded-3xl border border-[#2A3037] bg-[#161B22] p-5 text-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-2 flex justify-end">
                  {!requiresProjectCreation ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowOnboardingPopup(false);
                        void patchUiPreferences({
                          dismissedOnboardingPopup: true,
                        }).catch(() => {});
                      }}
                      className="grid h-7 w-7 place-items-center rounded-full border border-zinc-500 bg-[#2A3037] text-zinc-200 hover:border-zinc-300"
                      aria-label="Close popup"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                {/* <p className="inline-flex rounded-full bg-indigo-500/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
                  First login
                </p> */}
                <h3 className="mt-2 text-xl font-bold">
                  {requiresProjectCreation
                    ? "Create your first project to continue"
                    : "Complete onboarding to unlock all pages"}
                </h3>
                <p className="mt-2 text-sm text-zinc-400">
                  {requiresProjectCreation
                    ? "This prompt stays visible until at least one project is created."
                    : "Finish these steps, then continue to subscription and payment."}
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  <li className="rounded-xl border border-[#2A3037] bg-[#0F1318] px-3 py-2">
                    {onboarding.hasProject ? "✅" : "⬜"} Create your first
                    project
                  </li>
                  <li className="rounded-xl border border-[#2A3037] bg-[#0F1318] px-3 py-2">
                    {onboarding.hasAssetsReady ? "✅" : "⬜"} Upload required
                    project assets
                  </li>
                  <li className="rounded-xl border border-[#2A3037] bg-[#0F1318] px-3 py-2">
                    {onboarding.hasActiveSubscription ? "✅" : "⬜"} Choose
                    plan/add-on and complete payment
                  </li>
                </ul>
                <div className="mt-4 flex gap-2">
                  <Link
                    to="/projects"
                    className="rounded-lg border border-zinc-500 bg-[#2A3037] px-3 py-2 text-sm font-semibold text-white"
                  >
                    Create a Project
                  </Link>
                  <Link
                    to="/subscription"
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      requiresProjectCreation
                        ? "pointer-events-none bg-zinc-600 text-zinc-300"
                        : "bg-white text-canvas"
                    }`}
                  >
                    Continue to Subscription
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </section>
    </div>
  );
}
