import { Breadcrumb } from "@/components/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  getProjectById,
  CORE_REQUIRED_PROJECT_ASSETS,
  listProjectsByUser,
  hasValidProjectPlan,
} from "@/services/projectsStore";
import {
  finalizeProjectCheckoutOnce,
  PROJECT_CHECKOUT_INTENT_KEY,
  type ProjectCheckoutIntent,
} from "@/services/projectCheckoutFinalize";
import { dispatchProjectsListInvalidate } from "@/services/projectsInvalidate";
import {
  changePlan,
  createAddonCheckoutSession,
  createCheckoutSession,
  fetchCustomerPortal,
  fetchProjectAssets,
} from "@/services/subscriptionsApi";
import type { BillingCycle, Plan, SubscriptionAddon } from "@/types/subscription";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ProjectRecord } from "@/types/project";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** Inline checkout feedback in one place (same slot as confirming). */
type ProjectCheckoutReturnBanner =
  | null
  | { phase: "confirming" }
  | { phase: "success" }
  | { phase: "error"; message: string };

function planIsOneTimeOnly(plan: { billingMonthlyEnabled?: boolean; billingYearlyEnabled?: boolean }) {
  return plan.billingMonthlyEnabled === false && plan.billingYearlyEnabled === false;
}

function planDisplayAmount(plan: Plan, cycle: BillingCycle) {
  if (planIsOneTimeOnly(plan)) return plan.priceMonthlyCents;
  if (plan.billingYearlyEnabled === false) return plan.priceMonthlyCents;
  if (plan.billingMonthlyEnabled === false) return plan.priceYearlyCents;
  return cycle === "yearly" ? plan.priceYearlyCents : plan.priceMonthlyCents;
}

function resolveBillingCycleForPlan(plan: Plan, preferred: BillingCycle): BillingCycle {
  const m = plan.billingMonthlyEnabled !== false;
  const y = plan.billingYearlyEnabled !== false;
  if (m && y) return preferred;
  if (m) return "monthly";
  if (y) return "yearly";
  return "monthly";
}

function addonEligibleForCheckout(addon: SubscriptionAddon, cycle: BillingCycle, plan: Plan | null) {
  if (!plan) return false;
  if (planIsOneTimeOnly(plan)) {
    return addon.billingMonthlyEnabled === false && addon.billingYearlyEnabled === false;
  }
  const am = addon.billingMonthlyEnabled !== false;
  const ay = addon.billingYearlyEnabled !== false;
  if (!am && !ay) return true;
  return cycle === "yearly" ? ay : am;
}

export function ProjectSubscriptionPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { portal, refresh: refreshUser } = useUser();
  const userId = user?.id ?? portal?.user?.id ?? "guest-user";
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [addons, setAddons] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [plans, setPlans] = useState(() => portal?.plans ?? []);
  const [addonCatalog, setAddonCatalog] = useState(() => portal?.addons ?? []);
  const [ready, setReady] = useState(false);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const checkoutReturnHandledRef = useRef<string | null>(null);
  /** Cleared on effect cleanup so Strict Mode remount can re-enter; `finalizeProjectCheckoutOnce` dedupes by `startedAt`. */
  const checkoutFinalizeInProgressRef = useRef<string | null>(null);
  const [checkoutReturnBanner, setCheckoutReturnBanner] =
    useState<ProjectCheckoutReturnBanner>(null);
  const ownedProject = project && project.ownerUserId === userId ? project : null;
  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );
  const addonByCode = useMemo(() => new Map(addonCatalog.map((addon) => [addon.code, addon])), [addonCatalog]);
  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.priceMonthlyCents - b.priceMonthlyCents),
    [plans],
  );
  const hasLiveProjectPlan = Boolean(ownedProject && hasValidProjectPlan(ownedProject));
  const currentTier = useMemo(() => {
    if (!hasLiveProjectPlan || !ownedProject?.planId) return -1;
    return sortedPlans.findIndex((p) => p.id === ownedProject.planId);
  }, [hasLiveProjectPlan, ownedProject?.planId, sortedPlans]);
  const selectedTier = useMemo(() => {
    if (!selectedPlanId) return -1;
    return sortedPlans.findIndex((p) => p.id === selectedPlanId);
  }, [selectedPlanId, sortedPlans]);
  const isDowngradeSelection =
    hasLiveProjectPlan &&
    currentTier >= 0 &&
    selectedTier >= 0 &&
    selectedTier < currentTier;
  const ownedAddonCodes = useMemo(() => new Set(ownedProject?.addons ?? []), [ownedProject?.addons]);

  const anyMonthly = useMemo(() => plans.some((p) => p.billingMonthlyEnabled !== false), [plans]);
  const anyYearly = useMemo(() => plans.some((p) => p.billingYearlyEnabled !== false), [plans]);
  const showBillingCycleToggle = anyMonthly || anyYearly;

  const eligibleAddons = useMemo(
    () => addonCatalog.filter((a) => addonEligibleForCheckout(a, billingCycle, selectedPlan)),
    [addonCatalog, billingCycle, selectedPlan],
  );

  useEffect(() => {
    if (!selectedPlan) return;
    setBillingCycle((prev) => resolveBillingCycleForPlan(selectedPlan, prev));
  }, [selectedPlan]);

  useEffect(() => {
    setAddons((prev) => prev.filter((code) => eligibleAddons.some((a) => a.code === code)));
  }, [eligibleAddons]);

  useEffect(() => {
    if (!anyMonthly && anyYearly) setBillingCycle("yearly");
    else if (anyMonthly && !anyYearly) setBillingCycle("monthly");
  }, [anyMonthly, anyYearly]);

  useEffect(() => {
    if (portal?.plans && portal.plans.length > 0) {
      setPlans(portal.plans);
    }
    setAddonCatalog(portal?.addons ?? []);
  }, [portal?.addons, portal?.plans]);

  useEffect(() => {
    let cancelled = false;
    setProjectLoading(true);
    void getProjectById(projectId)
      .then((row) => {
        if (!cancelled) setProject(row);
      })
      .finally(() => {
        if (!cancelled) setProjectLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!ownedProject) {
      setReady(false);
      return;
    }
    let cancelled = false;
    void fetchProjectAssets(ownedProject.id)
      .then((assets) => {
        if (cancelled) return;
        const value = CORE_REQUIRED_PROJECT_ASSETS.every((req) =>
          assets.some((asset) => asset.type === req.type),
        );
        setReady(value);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownedProject?.id]);

  useEffect(() => {
    if (!ownedProject) return;
    let cancelled = false;
    void fetchCustomerPortal({ projectId: ownedProject.id })
      .then((payload) => {
        if (cancelled) return;
        setPlans(payload.plans ?? []);
        setAddonCatalog(payload.addons ?? []);
      })
      .catch(() => {
        // Keep existing plans from context if local fetch fails.
      });
    return () => {
      cancelled = true;
    };
  }, [ownedProject?.id]);

  useEffect(() => {
    if (!ownedProject || !hasValidProjectPlan(ownedProject)) return;
    setSelectedPlanId(ownedProject.planId ?? "");
    setBillingCycle(ownedProject.billingCycle ?? "monthly");
    setAddons([]);
  }, [ownedProject?.id, ownedProject?.planId]);

  async function onApplySubscriptionChanges() {
    if (!selectedPlan || !ownedProject) return;
    if (!hasValidProjectPlan(ownedProject)) return;
    const newAddonCodes = addons.filter((c) => !ownedAddonCodes.has(c));
    const effectiveOwnedCycle: BillingCycle = ownedProject.billingCycle ?? "monthly";
    const planOrCycleChanged =
      selectedPlanId !== ownedProject.planId || billingCycle !== effectiveOwnedCycle;
    setBusy(true);
    setNotice(null);
    try {
      if (planOrCycleChanged) {
        await changePlan(selectedPlanId, billingCycle, { projectId: ownedProject.id });
      }
      if (newAddonCodes.length > 0) {
        const base = `${window.location.origin}/projects/${ownedProject.id}`;
        const { url } = await createAddonCheckoutSession(ownedProject.id, newAddonCodes, {
          successUrl: base,
          cancelUrl: `${window.location.origin}/projects/${ownedProject.id}/subscription`,
        });
        if (!url) {
          setNotice("Could not start add-on checkout.");
          return;
        }
        window.location.assign(url);
        return;
      }
      await listProjectsByUser(userId, { force: true });
      await refreshUser();
      navigate({ pathname: `/projects/${ownedProject.id}` }, { replace: true });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not update subscription.");
    } finally {
      setBusy(false);
    }
  }

  async function onSecureCheckout() {
    if (!selectedPlan || !ownedProject) return;
    setBusy(true);
    setNotice(null);
    try {
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.delete("subscriptionFunnel");
      returnUrl.searchParams.set("projectCheckout", "1");
      const intent: ProjectCheckoutIntent = {
        projectId: ownedProject.id,
        planId: selectedPlan.id,
        billingCycle,
        addons,
        startedAt: Date.now(),
        oneTimePlan: planIsOneTimeOnly(selectedPlan),
      };
      window.localStorage.setItem(PROJECT_CHECKOUT_INTENT_KEY, JSON.stringify(intent));
      const { url } = await createCheckoutSession(selectedPlan.id, billingCycle, {
        addons,
        projectId: ownedProject.id,
        successUrl: returnUrl.toString(),
        cancelUrl: returnUrl.toString(),
      });
      if (!url) {
        setNotice("Could not start Stripe checkout session.");
        return;
      }
      window.location.assign(url);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to start Stripe checkout.");
    } finally {
      setBusy(false);
    }
  }

  const selectedPlanAmount = selectedPlan ? planDisplayAmount(selectedPlan, billingCycle) : 0;
  const effectiveOwnedBilling: BillingCycle = ownedProject?.billingCycle ?? "monthly";
  const planOrCycleDirty =
    hasLiveProjectPlan &&
    Boolean(ownedProject) &&
    (selectedPlanId !== ownedProject?.planId || billingCycle !== effectiveOwnedBilling);
  const newAddonsDirty = addons.some((code) => !ownedAddonCodes.has(code));
  const nothingToApplyLive = hasLiveProjectPlan && !planOrCycleDirty && !newAddonsDirty;
  const addonsTotal = addons.reduce((sum, code) => {
    const item = addonByCode.get(code);
    return sum + (item?.priceCents ?? 0);
  }, 0);
  const funnelState = searchParams.get("subscriptionFunnel");

  useEffect(() => {
    if (funnelState !== "checkout_return") return;
    const raw = window.localStorage.getItem(PROJECT_CHECKOUT_INTENT_KEY);
    if (!raw) return;
    let intent: ProjectCheckoutIntent | null = null;
    try {
      intent = JSON.parse(raw) as ProjectCheckoutIntent;
    } catch {
      window.localStorage.removeItem(PROJECT_CHECKOUT_INTENT_KEY);
      return;
    }
    if (!intent) return;
    if (!ownedProject || intent.projectId !== ownedProject.id) return;
    const runKey = `${intent.projectId}:${intent.startedAt}`;
    if (checkoutReturnHandledRef.current === runKey) return;
    if (checkoutFinalizeInProgressRef.current === runKey) return;
    if (Date.now() - intent.startedAt > 2 * 60 * 60 * 1000) {
      window.localStorage.removeItem(PROJECT_CHECKOUT_INTENT_KEY);
      checkoutReturnHandledRef.current = runKey;
      setNotice("Checkout intent expired. Please try payment again.");
      return;
    }
    checkoutFinalizeInProgressRef.current = runKey;
    setSelectedPlanId((prev) => (prev === intent.planId ? prev : intent.planId));
    setBillingCycle((prev) => (prev === intent.billingCycle ? prev : intent.billingCycle));
    setAddons((prev) => {
      const next = intent?.addons ?? [];
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
      return next;
    });
    let cancelled = false;
    setCheckoutReturnBanner({ phase: "confirming" });
    void (async () => {
      try {
        await finalizeProjectCheckoutOnce(intent);
        if (cancelled) return;
        setCheckoutReturnBanner({ phase: "success" });
        dispatchProjectsListInvalidate();
        await listProjectsByUser(userId, { force: true });
        await refreshUser();
        if (!cancelled) {
          navigate({ pathname: "/projects" }, { replace: true });
        }
      } catch (err) {
        checkoutFinalizeInProgressRef.current = null;
        if (!cancelled) {
          setCheckoutReturnBanner({
            phase: "error",
            message:
              err instanceof Error
                ? err.message
                : "Could not confirm payment with Stripe. Please retry.",
          });
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete("subscriptionFunnel");
              return next;
            },
            { replace: true },
          );
        }
      } finally {
        checkoutFinalizeInProgressRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
      checkoutFinalizeInProgressRef.current = null;
      setCheckoutReturnBanner((b) => (b?.phase === "confirming" ? null : b));
    };
  }, [funnelState, ownedProject?.id, navigate, refreshUser, setSearchParams, userId]);

  const checkoutReturnLocksUI =
    checkoutReturnBanner?.phase === "confirming" ||
    checkoutReturnBanner?.phase === "success";

  if (!project && !projectLoading) return <Navigate to="/projects" replace />;
  if (!project) return <div className="p-6 text-sm text-zinc-300">Loading project...</div>;
  if (!ownedProject) return <Navigate to="/projects" replace />;

  return (
    <div className="client-workspace-view space-y-6 text-zinc-900">
      <Breadcrumb
        items={[
          { label: "Home", to: "/dashboard" },
          { label: "My Projects", to: "/projects" },
          { label: "Subscription" },
        ]}
      />

      <header className="rounded-2xl border border-transparent bg-transparent p-2 text-center sm:p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Project Checkout
        </p>
        <h1 className="subscription-hero-title mt-1.5 text-4xl font-bold tracking-tight text-zinc-900">
          Choose the right plan for your project
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          Unlock all features and activate your workspace by selecting a subscription. Cancel or upgrade anytime.
        </p>
      </header>
      {checkoutReturnBanner?.phase === "confirming" ? (
        <p
          className="rounded-xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-100"
          aria-live="polite"
        >
          Confirming your payment with Stripe…
        </p>
      ) : checkoutReturnBanner?.phase === "success" ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-100 shadow-lg backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <svg
            className="h-5 w-5 shrink-0 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="min-w-0 flex-1 leading-snug">Payment completed successfully.</p>
        </div>
      ) : checkoutReturnBanner?.phase === "error" ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100 shadow-lg backdrop-blur-sm"
          role="alert"
        >
          <svg
            className="h-5 w-5 shrink-0 text-rose-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="min-w-0 flex-1 leading-snug">{checkoutReturnBanner.message}</p>
        </div>
      ) : null}
      {notice ? (
        <p className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {notice}
        </p>
      ) : null}

      {!ready ? (
        <section className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-5 text-sm text-amber-200">
          Required onboarding assets are incomplete for this project. Complete
          setup in{" "}
          <Link to="/projects" className="font-semibold underline">
            My Projects
          </Link>{" "}
          before checkout.
        </section>
      ) : plans.length === 0 ? (
        <section className="rounded-2xl border border-[#2A3037] bg-[#15191C] p-5 text-sm text-zinc-300 shadow-glass">
          Plans are not available right now. Please retry after portal data
          loads.
        </section>
      ) : (
        <div aria-busy={checkoutReturnLocksUI ? true : undefined}>
          <div className="mx-auto inline-flex rounded-full border border-[#2A3037] bg-[#1C2126] p-1">
            {showBillingCycleToggle ? (
              <>
                {anyMonthly ? (
                  <button
                    type="button"
                    disabled={checkoutReturnLocksUI}
                    onClick={() => setBillingCycle("monthly")}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      billingCycle === "monthly" ? "bg-white text-canvas" : "text-zinc-300 hover:text-white"
                    }`}
                  >
                    Monthly
                  </button>
                ) : null}
                {anyYearly ? (
                  <button
                    type="button"
                    disabled={checkoutReturnLocksUI}
                    onClick={() => setBillingCycle("yearly")}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      billingCycle === "yearly" ? "bg-white text-canvas" : "text-zinc-300 hover:text-white"
                    }`}
                  >
                    Yearly
                  </button>
                ) : null}
              </>
            ) : (
              <p className="px-4 py-2 text-center text-xs text-zinc-400">Plans shown are one-time purchases only.</p>
            )}
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => {
              const active = selectedPlanId === plan.id;
              const amount = planDisplayAmount(plan, billingCycle);
              const tier = sortedPlans.findIndex((p) => p.id === plan.id);
              const locked =
                hasLiveProjectPlan &&
                currentTier >= 0 &&
                tier >= 0 &&
                tier < currentTier;
              return (
                <article
                  key={plan.id}
                  className={`rounded-2xl border p-5 shadow-glass transition ${
                    locked
                      ? "cursor-not-allowed border-[#2A3037] bg-[#101317] opacity-45"
                      : active
                        ? "border-white bg-[#1C2126] text-white"
                        : "client-plan-card-inactive border-[#2A3037] bg-[#15191C]"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">
                    {plan.code}
                  </p>
                  <h2 className="mt-1 text-xl font-bold">{plan.name}</h2>
                  <p className={`mt-2 text-4xl font-black ${active ? "text-white" : ""}`}>
                    {money(amount, plan.currency)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>
                  <ul className="mt-3 space-y-1 text-sm text-zinc-300">
                    {plan.features.slice(0, 5).map((feature) => (
                      <li key={feature}>• {feature}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={locked || checkoutReturnLocksUI}
                    onClick={() => {
                      if (!locked && !checkoutReturnLocksUI) setSelectedPlanId(plan.id);
                    }}
                    className={`mt-4 w-full rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      locked
                        ? "cursor-not-allowed bg-[#1C2126] text-zinc-500"
                        : active
                          ? "bg-white text-canvas hover:bg-zinc-100"
                          : "bg-[#2A3037] text-white hover:bg-[#343B45]"
                    }`}
                  >
                    {locked ? "Lower tier" : active ? "Selected" : "Select plan"}
                  </button>
                </article>
              );
            })}
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-2xl border border-[#2A3037] bg-[#15191C] p-5">
              <h3 className="text-xl font-semibold text-white">Enhance Your Plan</h3>
              <p className="mt-1 text-sm text-zinc-400">
                {hasLiveProjectPlan
                  ? "Add-ons already on your subscription cannot be purchased again. Pick new extras to buy."
                  : "Add powerful extras to accelerate your project."}
              </p>
              <div className="mt-4 space-y-3">
                {addonCatalog.filter(
                  (a) =>
                    ownedAddonCodes.has(a.code) ||
                    addonEligibleForCheckout(a, billingCycle, selectedPlan),
                ).length === 0 ? (
                  <p className="text-sm text-zinc-500">No add-ons are available for this plan and billing choice.</p>
                ) : null}
                {addonCatalog
                  .filter(
                    (a) =>
                      ownedAddonCodes.has(a.code) ||
                      addonEligibleForCheckout(a, billingCycle, selectedPlan),
                  )
                  .map((addon) => {
                    const owned = ownedAddonCodes.has(addon.code);
                    const selected = addons.includes(addon.code);
                    if (owned) {
                    return (
                      <div
                        key={addon.code}
                        aria-disabled
                        className="w-full cursor-not-allowed select-none rounded-xl border border-[#2A3037] bg-[#0F1318] px-4 py-3 text-left opacity-70"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-zinc-400">{addon.label}</p>
                          <p className="text-sm font-semibold text-zinc-500">{money(addon.priceCents)}</p>
                        </div>
                        <p className="mt-1 text-xs text-zinc-600">{addon.desc}</p>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Existing add-on
                        </p>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={addon.code}
                      type="button"
                      disabled={checkoutReturnLocksUI}
                      onClick={() =>
                        setAddons((prev) =>
                          prev.includes(addon.code) ? prev.filter((code) => code !== addon.code) : [...prev, addon.code],
                        )
                      }
                      className={`w-full rounded-xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        selected ? "border-white bg-[#1C2126]" : "border-[#2A3037] bg-[#101317] hover:border-zinc-400"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-white">{addon.label}</p>
                        <p className="text-sm font-semibold text-zinc-200">{money(addon.priceCents)}</p>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">{addon.desc}</p>
                    </button>
                  );
                  })}
              </div>
            </div>
            <div className="rounded-2xl border border-[#2A3037] bg-[#15191C] p-5">
              <h3 className="text-xl font-semibold text-white">Order Summary</h3>
              <div className="mt-4 space-y-2 text-sm">
                {selectedPlan ? (
                  <div className="flex items-center justify-between text-zinc-200">
                    <span className="font-medium">
                      {selectedPlan.name}{" "}
                      <span className="text-zinc-400">
                        ({planIsOneTimeOnly(selectedPlan) ? "one-time" : billingCycle})
                      </span>
                    </span>
                    <span className="font-medium">{money(selectedPlanAmount, selectedPlan.currency)}</span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[#2A3037] px-3 py-2 text-xs text-zinc-500">
                    Select a plan above to see pricing.
                  </div>
                )}
                {addons.length > 0 ? (
                  <p className="pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Add-ons</p>
                ) : null}
                {addons.map((code) => {
                  const item = addonByCode.get(code);
                  if (!item) return null;
                  return (
                    <div key={code} className="flex items-center justify-between text-zinc-300">
                      <span>{item.label}</span>
                      <span>{money(item.priceCents)}</span>
                    </div>
                  );
                })}
                <div className="mt-3 border-t border-[#2A3037] pt-3">
                  <div className="client-ink-on-panel flex items-center justify-between text-lg font-semibold">
                    <span>Total Due Today</span>
                    <span>{money(selectedPlanAmount + addonsTotal, selectedPlan?.currency)}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={
                  !selectedPlan ||
                  busy ||
                  checkoutReturnLocksUI ||
                  (hasLiveProjectPlan && (isDowngradeSelection || nothingToApplyLive))
                }
                onClick={() => {
                  if (checkoutReturnLocksUI) return;
                  void (hasLiveProjectPlan ? onApplySubscriptionChanges() : onSecureCheckout());
                }}
                className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-canvas transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy
                  ? "Processing..."
                  : checkoutReturnBanner?.phase === "confirming"
                    ? "Confirming payment…"
                    : checkoutReturnBanner?.phase === "success"
                      ? "Redirecting…"
                      : hasLiveProjectPlan
                        ? "Apply changes"
                        : "Proceed to Pay"}
              </button>
              <p className="mt-2 text-center text-xs text-zinc-500">Secure checkout powered by Stripe</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
