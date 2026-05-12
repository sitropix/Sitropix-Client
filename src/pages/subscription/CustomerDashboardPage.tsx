import { Breadcrumb } from "@/components/Breadcrumb";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { InvoiceTablePaged } from "@/components/subscription/InvoiceTablePaged";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  hasValidProjectPlan,
  listProjectsByUser,
} from "@/services/projectsStore";
import type { AccountProfile } from "@/types/account";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

/** Title-style for display (first letter upper, remainder lower). Empty strings stay empty. */
function capitalizeSegment(value: string): string {
  const t = value.trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Hi {name}, … — prefers contact names; falls back to portal user full name parsing. */
function greetingDisplayName(
  contact: AccountProfile | null,
  fallbackFullName?: string,
): string {
  if (contact) {
    const first = capitalizeSegment(contact.firstName ?? "");
    const last = capitalizeSegment(contact.lastName ?? "");
    if (first && last) return `${first} ${last}`;
    if (first) return first;
    if (last) return last;
  }
  const raw = fallbackFullName?.trim();
  if (raw) {
    const segments = raw.split(/\s+/).map(capitalizeSegment).filter(Boolean);
    if (segments.length === 1) return segments[0]!;
    if (segments.length > 1)
      return `${segments[0]} ${segments.slice(1).join(" ")}`;
  }
  return "there";
}

function formatDate(iso?: string) {
  return iso
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        new Date(iso),
      )
    : "—";
}

function IconBox({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`quick-link-icon-box flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/65 bg-white/55 text-zinc-800 backdrop-blur-md transition group-hover:border-white/80 group-hover:bg-white/70 ${className}`}
    >
      {children}
    </span>
  );
}

function ChevronRight({ className }: { className?: string }) {
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
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

const quickLinks: Array<{
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
  iconHoverClass: string;
}> = [
  {
    to: "/subscription-management",
    title: "Subscription Management",
    description: "Plan, payment method and invoices",
    iconHoverClass: "group-hover:bg-sky-100/80 group-hover:text-sky-700",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path d="M2.25 8.25h19.5M2.25 9.75h19.5M4.5 6.75h15a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0119.5 21.75h-15a2.25 2.25 0 01-2.25-2.25V9A2.25 2.25 0 014.5 6.75z" />
      </svg>
    ),
  },
  {
    to: "/requests",
    title: "Messages",
    description: "Track support conversations",
    iconHoverClass: "group-hover:bg-rose-100/80 group-hover:text-rose-700",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.33L3 21l2.395-4.365A8.16 8.16 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
  {
    to: "/workspace",
    title: "Files",
    description: "Project docs and downloads",
    iconHoverClass:
      "group-hover:bg-emerald-100/80 group-hover:text-emerald-700",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    to: "/projects",
    title: "My Projects",
    description: "Create and manage project setups",
    iconHoverClass: "group-hover:bg-cyan-100/80 group-hover:text-cyan-700",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3.75 5.25h6.5l1.5 2h8a1.5 1.5 0 011.5 1.5v9.5a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5v-11.5a1.5 1.5 0 011.5-1.5z" />
        <path d="M8 12h8M8 15h5" />
      </svg>
    ),
  },
  {
    to: "/kb",
    title: "Knowledge Base",
    description: "Guides and product docs",
    iconHoverClass: "group-hover:bg-violet-100/80 group-hover:text-violet-700",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.955 8.955 0 016 18c1.8 0 3.464-.517 4.875-1.407M12 6.042A8.967 8.967 0 0118 3.75c1.052 0 2.062.18 3 .512v14.25a8.955 8.955 0 01-3 .563c-1.8 0-3.464-.517-4.875-1.407M12 6.042v14.25" />
      </svg>
    ),
  },
];

export function CustomerDashboardPage() {
  const { user } = useAuth();
  const { portal, loading, error, contact } = useUser();
  const [projects, setProjects] = useState<
    Awaited<ReturnType<typeof listProjectsByUser>>
  >([]);
  const resolvedUserId = user?.id ?? portal?.user?.id ?? "guest-user";
  useEffect(() => {
    let cancelled = false;
    void listProjectsByUser(resolvedUserId)
      .then((rows) => {
        if (!cancelled) setProjects(rows);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedUserId]);
  const greeting = greetingDisplayName(contact, portal?.user?.name);
  const invoices = portal?.invoices ?? [];

  return (
    <div className="space-y-6 opacity-0 animate-fade-up [animation-fill-mode:forwards]">
      <Breadcrumb
        items={[{ label: "Home", to: "/dashboard" }, { label: "Dashboard" }]}
      />

      <section className="relative overflow-hidden rounded-2xl bg-white shadow-glass">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_35%,rgba(172,173,177,0.2),transparent_42%),radial-gradient(circle_at_88%_88%,rgba(172,173,177,0.2),transparent_72%)]" />
        <div className="pointer-events-none absolute inset-0 bg-card-shine opacity-20" />
        <div className="relative px-6 py-7 sm:px-9 sm:py-8">
          <p className="hero-eyebrow-chip inline-flex items-center rounded-[12px] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
            Sitropix Support
          </p>
          <h1 className="mt-2.5 text-balance text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Hi {greeting}, how can we help?
          </h1>
          <p className="mt-2.5 max-w-2xl text-pretty text-sm leading-relaxed text-zinc-700 sm:text-[15px]">
            Search guides from the bar above, track requests, and manage your
            workspace from this hub.
          </p>
        </div>
      </section>

      {loading && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((k) => (
              <Skeleton key={k} className="h-[104px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      )}
      {error && (
        <p className="rounded-xl border border-rose-400/40 bg-rose-100 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      {!loading && projects.length === 0 && (
        <EmptyState
          title="No projects yet"
          description="Create a project, complete intake, and subscribe from that project’s checkout to unlock the full workspace."
          action={{ label: "Create a Project", href: "/projects" }}
        />
      )}

      {!loading && projects.length > 0 && (
        <>
          <section className="jump-back-panel relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-200/70 via-sky-50/35 to-zinc-200/65 shadow-[0_0_0_1px_rgba(255,255,255,0.7),0_0_0_6px_rgba(255,255,255,0.08),0_12px_24px_rgba(53,53,54,0.12)] backdrop-blur-sm">
            <div className="border-b border-zinc-300 px-6 py-4 sm:px-7 sm:py-5">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">
                Jump back in
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-700">
                Self-serve first — we are here when you need a human.
              </p>
            </div>
            <div className="grid gap-3 p-4 sm:p-5 sm:grid-cols-2 xl:grid-cols-5">
              {quickLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="quick-link-card group relative flex gap-4 overflow-hidden rounded-xl border border-white/45 bg-white/24 p-4 shadow-[0_14px_28px_rgba(53,53,54,0.2)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-white/70 hover:bg-white/42"
                >
                  <span
                    aria-hidden
                    className="quick-link-card-overlay pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.3)_0%,rgba(255,255,255,0.08)_48%,rgba(255,255,255,0.24)_100%)] opacity-75"
                  />
                  <IconBox className={item.iconHoverClass}>{item.icon}</IconBox>
                  <div className="relative min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className="relative mt-1 h-5 w-5 shrink-0 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-zinc-900" />
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
            <div className="dashboard-plan-shell relative overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-glass">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-500/60 to-transparent" />
              <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:min-h-[250px] xl:gap-6">
                <div className="plan-highlight-card flex min-w-0 flex-col rounded-xl bg-zinc-50/60 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Plans by project
                  </p>
                  <div className="mt-2 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                    {projects.map((p) => {
                      const live = hasValidProjectPlan(p);
                      const holding =
                        !live &&
                        (p.subscriptionStatus === "on_hold" ||
                          (p.planId && p.planName && p.planValidUntil));
                      const label = live
                        ? "Active"
                        : holding
                          ? "On hold"
                          : "Not subscribed";
                      return (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200/80 bg-white/80 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-900">
                              {p.name}
                            </p>
                            <p className="truncate text-xs text-zinc-600">
                              {p.planName ?? "—"}
                              {live && p.planValidUntil ? (
                                <span className="text-zinc-500">
                                  {" "}
                                  · Renews {formatDate(p.planValidUntil)}
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              live
                                ? "bg-emerald-100 text-emerald-900"
                                : holding
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-zinc-200 text-zinc-700"
                            }`}
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <Link
                    to="/subscription-management"
                    className="plan-cta-light mt-3 inline-flex w-full min-w-0 items-center justify-center rounded-lg bg-zinc-900 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800"
                  >
                    Manage billing
                  </Link>
                </div>
              </div>
            </div>

            <div className="dashboard-invoices-shell rounded-2xl border border-zinc-300 bg-white p-4 shadow-glass sm:p-5">
              <div className="flex min-h-0 flex-col gap-2">
                <div className="flex items-end justify-between">
                  <h2 className="text-xs font-semibold text-zinc-900">
                    Invoices
                  </h2>
                </div>
                {invoices.length > 0 ? (
                  <InvoiceTablePaged invoices={invoices} />
                ) : (
                  <EmptyState
                    title="No invoices yet"
                    description="Completed payments will list PDFs and receipt links here and under Subscription Management."
                    action={{
                      label: "Subscription Management",
                      href: "/subscription-management",
                    }}
                  />
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
