import { AddonBillingCycleToggle, AddonOfferCard } from "@/components/billing/addonDisplay";
import { AddonNotAvailableModal } from "@/components/billing/AddonNotAvailableModal";
import { ExtraEditPurchaseModal } from "@/components/billing/ExtraEditPurchaseModal";
import { Breadcrumb } from "@/components/Breadcrumb";
import { portal as portalUi } from "@/components/portal/portalStyles";
import {
  canOfferExtraEditPurchases,
  EXTRA_EDIT_BUNDLE_CODE,
  EXTRA_EDIT_SINGLE_CODE,
  isCreditPackAddon,
  readExtraEditPricingForPlan,
  resolveExtraEditPurchaseAddons,
} from "@/constants/extraEditAddons";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  addonCheckoutDisplayCents,
  addonPriceCycleSuffix,
  defaultAddonRecurringCycle,
  isAddonRecurring,
} from "@/lib/addonDisplayHelpers";
import { resolveAddonPlanPriceCents } from "@/lib/addonPlanPricing";
import {
  addonEligibleForPlan,
  planForAddonPurchaseGate,
} from "@/lib/addonPlanEligibility";
import { formatBillingApiError } from "@/lib/billingErrors";
import { ApiRequestError } from "@/services/http";
import {
  finalizeProjectCheckoutOnce,
  PROJECT_CHECKOUT_INTENT_KEY,
  type ProjectCheckoutIntent,
} from "@/services/projectCheckoutFinalize";
import { dispatchProjectsListInvalidate } from "@/services/projectsInvalidate";
import {
  CORE_REQUIRED_PROJECT_ASSETS,
  getProjectById,
  hasValidProjectPlan,
  listProjectsByUser,
} from "@/services/projectsStore";
import {
  changePlan,
  createAddonCheckoutSession,
  createCheckoutSession,
  fetchCustomerPortal,
  fetchProjectAssets,
} from "@/services/subscriptionsApi";
import type { ProjectRecord } from "@/types/project";
import type {
  BillingCycle,
  Plan,
  SubscriptionAddon,
} from "@/types/subscription";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

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

function planIsOneTimeOnly(plan: {
  billingMonthlyEnabled?: boolean;
  billingYearlyEnabled?: boolean;
}) {
  return (
    plan.billingMonthlyEnabled === false && plan.billingYearlyEnabled === false
  );
}

function planDisplayAmount(plan: Plan, cycle: BillingCycle) {
  if (planIsOneTimeOnly(plan)) return plan.priceMonthlyCents;
  if (plan.billingYearlyEnabled === false) return plan.priceMonthlyCents;
  if (plan.billingMonthlyEnabled === false) return plan.priceYearlyCents;
  return cycle === "yearly" ? plan.priceYearlyCents : plan.priceMonthlyCents;
}

function resolveBillingCycleForPlan(
  plan: Plan,
  preferred: BillingCycle,
): BillingCycle {
  const m = plan.billingMonthlyEnabled !== false;
  const y = plan.billingYearlyEnabled !== false;
  if (m && y) return preferred;
  if (m) return "monthly";
  if (y) return "yearly";
  return "monthly";
}

function addonEligibleForCheckout(
  addon: SubscriptionAddon,
  cycle: BillingCycle,
  plan: Plan | null,
) {
  if (!plan) return false;
  if (planIsOneTimeOnly(plan)) {
    return (
      addon.billingMonthlyEnabled === false &&
      addon.billingYearlyEnabled === false
    );
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
  const [addonRecurringCycle, setAddonRecurringCycle] = useState<BillingCycle>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [addons, setAddons] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [extraEditModalOpen, setExtraEditModalOpen] = useState(false);
  const [addonNotAvailableOpen, setAddonNotAvailableOpen] = useState(false);
  const [extraEditCompanionCodes, setExtraEditCompanionCodes] = useState<
    string[]
  >([]);
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
  const ownedProject =
    project && project.ownerUserId === userId ? project : null;
  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );
  const addonByCode = useMemo(
    () => new Map(addonCatalog.map((addon) => [addon.code, addon])),
    [addonCatalog],
  );
  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.priceMonthlyCents - b.priceMonthlyCents),
    [plans],
  );
  const hasLiveProjectPlan = Boolean(
    ownedProject && hasValidProjectPlan(ownedProject),
  );
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
  const ownedAddonCodes = useMemo(
    () => new Set(ownedProject?.addons ?? []),
    [ownedProject?.addons],
  );

  const anyMonthly = useMemo(
    () => plans.some((p) => p.billingMonthlyEnabled !== false),
    [plans],
  );
  const anyYearly = useMemo(
    () => plans.some((p) => p.billingYearlyEnabled !== false),
    [plans],
  );
  const showBillingCycleToggle = anyMonthly || anyYearly;

  const addonGatePlan = useMemo(
    () =>
      planForAddonPurchaseGate(
        hasLiveProjectPlan,
        ownedProject?.planId,
        selectedPlan,
        plans,
      ),
    [hasLiveProjectPlan, ownedProject?.planId, selectedPlan, plans],
  );

  const eligibleAddons = useMemo(
    () =>
      addonCatalog.filter(
        (a) =>
          !isCreditPackAddon(a) &&
          addonEligibleForPlan(a, addonGatePlan) &&
          addonEligibleForCheckout(a, billingCycle, selectedPlan),
      ),
    [addonCatalog, addonGatePlan, billingCycle, selectedPlan],
  );

  const purchasableCards = ownedProject?.accessibleAddons?.purchasable ?? [];
  const canChooseAddonCycleFromProject =
    ownedProject?.accessibleAddons?.billingContext?.canChooseRecurringAddonCycle ??
    false;
  const canChooseAddonCycleFromSelection = useMemo(() => {
    if (billingCycle !== "yearly" || !addonGatePlan) return false;
    return eligibleAddons.some((addon) => {
      if (!isAddonRecurring(addon) || (addon.setupFeeCents ?? 0) > 0) return false;
      const monthly = resolveAddonPlanPriceCents(addon, addonGatePlan, "monthly");
      const yearly = resolveAddonPlanPriceCents(addon, addonGatePlan, "yearly");
      return monthly > 0 && yearly > 0;
    });
  }, [billingCycle, addonGatePlan, eligibleAddons]);
  const canChooseAddonCycle =
    canChooseAddonCycleFromProject || canChooseAddonCycleFromSelection;
  const addonDisplayCycle: BillingCycle = canChooseAddonCycle
    ? addonRecurringCycle
    : billingCycle;

  useEffect(() => {
    setAddonRecurringCycle(
      defaultAddonRecurringCycle(ownedProject?.billingCycle ?? billingCycle, purchasableCards),
    );
  }, [ownedProject?.billingCycle, billingCycle, purchasableCards]);

  useEffect(() => {
    if (!selectedPlan) return;
    setBillingCycle((prev) => resolveBillingCycleForPlan(selectedPlan, prev));
  }, [selectedPlan]);

  useEffect(() => {
    setAddons((prev) =>
      prev.filter((code) => eligibleAddons.some((a) => a.code === code)),
    );
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
    setNotice(null);
  }, [projectId]);

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
    const effectiveOwnedCycle: BillingCycle =
      ownedProject.billingCycle ?? "monthly";
    const planOrCycleChanged =
      selectedPlanId !== ownedProject.planId ||
      billingCycle !== effectiveOwnedCycle;
    const gatePlan = planForAddonPurchaseGate(
      hasLiveProjectPlan,
      ownedProject.planId,
      selectedPlan,
      plans,
    );
    const ineligibleAddon = newAddonCodes
      .map((code) => addonByCode.get(code))
      .find((row) => row && !addonEligibleForPlan(row, gatePlan));
    if (ineligibleAddon) {
      setAddonNotAvailableOpen(true);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      if (planOrCycleChanged) {
        await changePlan(selectedPlanId, billingCycle, {
          projectId: ownedProject.id,
        });
      }
      if (newAddonCodes.length > 0) {
        const editSelected: string[] = newAddonCodes.filter(
          (c) => c === EXTRA_EDIT_SINGLE_CODE || c === EXTRA_EDIT_BUNDLE_CODE,
        );
        const companion = newAddonCodes.filter(
          (c) => !editSelected.includes(c),
        );
        if (editSelected.length > 1) {
          setNotice(
            "Choose only one extra-edits add-on (per-edit or bundle) per checkout.",
          );
          return;
        }
        if (editSelected.length === 1) {
          setExtraEditCompanionCodes(companion);
          setExtraEditModalOpen(true);
          return;
        }
        const base = `${window.location.origin}/projects/${ownedProject.id}`;
        const hasRecurring = newAddonCodes.some((code) => {
          const row = addonByCode.get(code);
          return row != null && isAddonRecurring(row);
        });
        const { url } = await createAddonCheckoutSession(
          ownedProject.id,
          newAddonCodes,
          {
            successUrl: base,
            cancelUrl: `${window.location.origin}/projects/${ownedProject.id}/subscription`,
            ...(canChooseAddonCycle && hasRecurring
              ? { addonRecurringCycle: addonDisplayCycle }
              : {}),
          },
        );
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
      if (
        err instanceof ApiRequestError &&
        err.code === "addon_not_eligible_for_plan"
      ) {
        setAddonNotAvailableOpen(true);
        return;
      }
      setNotice(formatBillingApiError(err, "Could not update subscription."));
    } finally {
      setBusy(false);
    }
  }

  async function onSecureCheckout() {
    if (!selectedPlan || !ownedProject) return;
    const ineligibleAddon = addons
      .map((code) => addonByCode.get(code))
      .find((row) => row && !addonEligibleForPlan(row, selectedPlan));
    if (ineligibleAddon) {
      setAddonNotAvailableOpen(true);
      return;
    }
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
      window.localStorage.setItem(
        PROJECT_CHECKOUT_INTENT_KEY,
        JSON.stringify(intent),
      );
      const { url } = await createCheckoutSession(
        selectedPlan.id,
        billingCycle,
        {
          addons,
          projectId: ownedProject.id,
          successUrl: returnUrl.toString(),
          cancelUrl: returnUrl.toString(),
        },
      );
      if (!url) {
        setNotice("Could not start Stripe checkout session.");
        return;
      }
      window.location.assign(url);
    } catch (err) {
      setNotice(formatBillingApiError(err, "Failed to start Stripe checkout."));
    } finally {
      setBusy(false);
    }
  }

  const selectedPlanAmount = selectedPlan
    ? planDisplayAmount(selectedPlan, billingCycle)
    : 0;
  const effectiveOwnedBilling: BillingCycle =
    ownedProject?.billingCycle ?? "monthly";
  const planOrCycleDirty =
    hasLiveProjectPlan &&
    Boolean(ownedProject) &&
    (selectedPlanId !== ownedProject?.planId ||
      billingCycle !== effectiveOwnedBilling);
  const newAddonsDirty = addons.some((code) => !ownedAddonCodes.has(code));
  const nothingToApplyLive =
    hasLiveProjectPlan && !planOrCycleDirty && !newAddonsDirty;
  const addonsTotal = addons.reduce((sum, code) => {
    const item = addonByCode.get(code);
    if (!item) return sum;
    return (
      sum + addonCheckoutDisplayCents(item, addonGatePlan, addonDisplayCycle)
    );
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
    setSelectedPlanId((prev) =>
      prev === intent.planId ? prev : intent.planId,
    );
    setBillingCycle((prev) =>
      prev === intent.billingCycle ? prev : intent.billingCycle,
    );
    setAddons((prev) => {
      const next = intent?.addons ?? [];
      if (prev.length === next.length && prev.every((v, i) => v === next[i]))
        return prev;
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
  }, [
    funnelState,
    ownedProject?.id,
    navigate,
    refreshUser,
    setSearchParams,
    userId,
  ]);

  const checkoutReturnLocksUI =
    checkoutReturnBanner?.phase === "confirming" ||
    checkoutReturnBanner?.phase === "success";

  if (!project && !projectLoading) return <Navigate to="/projects" replace />;
  if (!project)
    return <div className="p-6 text-sm text-zinc-300">Loading project...</div>;
  if (!ownedProject) return <Navigate to="/projects" replace />;

  const planForExtraEditModal =
    plans.find((p) => p.id === selectedPlanId) ??
    plans.find((p) => p.id === ownedProject.planId) ??
    null;
  const { single: subExtraEditSingle, bundle: subExtraEditBundle } =
    resolveExtraEditPurchaseAddons(addonCatalog, planForExtraEditModal);
  const {
    perEditCents: subModalPerEditCents,
    bundleCredits: subModalBundleCredits,
    bundleCents: subModalBundleCents,
  } = readExtraEditPricingForPlan(
    planForExtraEditModal,
    subExtraEditSingle,
    subExtraEditBundle,
  );
  const canBuyExtraEditsOnSub =
    hasLiveProjectPlan &&
    canOfferExtraEditPurchases(planForExtraEditModal, addonCatalog);

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
          Unlock all features and activate your workspace by selecting a
          subscription. Cancel or upgrade anytime.
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
          <p className="min-w-0 flex-1 leading-snug">
            Payment completed successfully.
          </p>
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
          <p className="min-w-0 flex-1 leading-snug">
            {checkoutReturnBanner.message}
          </p>
        </div>
      ) : null}
      {notice ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          <p className="min-w-0 flex-1 leading-snug">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold text-amber-100/90 hover:bg-amber-500/20"
            aria-label="Dismiss message"
          >
            Dismiss
          </button>
        </div>
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
          <div className="mx-auto inline-flex rounded-full border border-on-surface/10 bg-surface-container-low p-1 mb-4">
            {showBillingCycleToggle ? (
              <>
                {anyMonthly ? (
                  <button
                    type="button"
                    disabled={checkoutReturnLocksUI}
                    onClick={() => setBillingCycle("monthly")}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      billingCycle === "monthly"
                        ? "bg-on-surface text-surface"
                        : "text-on-surface-variant hover:text-on-surface"
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
                      billingCycle === "yearly"
                        ? "bg-on-surface text-surface"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    Yearly
                  </button>
                ) : null}
              </>
            ) : (
              <p className="px-4 py-2 text-center font-body-sm text-body-sm text-on-surface-variant">
                Plans shown are one-time purchases only.
              </p>
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
                  <p
                    className={`mt-2 text-4xl font-black ${active ? "text-white" : ""}`}
                  >
                    {money(amount, plan.currency)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {plan.description}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-zinc-300">
                    {plan.features.slice(0, 5).map((feature) => (
                      <li key={feature}>• {feature}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={locked || checkoutReturnLocksUI}
                    onClick={() => {
                      if (!locked && !checkoutReturnLocksUI)
                        setSelectedPlanId(plan.id);
                    }}
                    className={`mt-4 w-full rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      locked
                        ? "cursor-not-allowed opacity-50"
                        : active
                          ? portalUi.btnDark + " !w-full"
                          : portalUi.btnSecondary + " !w-full"
                    }`}
                  >
                    {locked
                      ? "Lower tier"
                      : active
                        ? "Selected"
                        : "Select plan"}
                  </button>
                </article>
              );
            })}
          </section>

          <section className="grid gap-4 mt-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className={portalUi.panel}>
              <h3 className="font-body text-body-lg font-semibold text-on-surface">
                Enhance your plan
              </h3>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                {hasLiveProjectPlan
                  ? "One-time add-ons can only be purchased once. Extra website edit credits can be bought again until you reach your plan limit."
                  : "Add powerful extras to accelerate your project."}
              </p>
              {canBuyExtraEditsOnSub ? (
                <div className={`${portalUi.addonCard} mt-4`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-body-sm text-body-sm text-on-surface">
                      Need more website edits this billing cycle?
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setExtraEditModalOpen(true)}
                      className={
                        portalUi.btnPrimary + " !px-3 !py-1.5 !text-xs"
                      }
                    >
                      Buy edit credits
                    </button>
                  </div>
                </div>
              ) : null}
              {canChooseAddonCycle ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Choose whether recurring add-ons bill monthly or yearly.
                  </p>
                  <AddonBillingCycleToggle
                    value={addonRecurringCycle}
                    onChange={setAddonRecurringCycle}
                    disabled={checkoutReturnLocksUI}
                  />
                </div>
              ) : null}
              <div className="mt-4 space-y-3">
                {addonCatalog.filter(
                  (a) =>
                    !isCreditPackAddon(a) &&
                    (ownedAddonCodes.has(a.code) ||
                      eligibleAddons.some((e) => e.code === a.code)),
                ).length === 0 ? (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    No add-ons are available for this plan and billing choice.
                  </p>
                ) : null}
                {addonCatalog
                  .filter(
                    (a) =>
                      !isCreditPackAddon(a) &&
                      (ownedAddonCodes.has(a.code) ||
                        eligibleAddons.some((e) => e.code === a.code)),
                  )
                  .map((addon) => {
                    const owned = ownedAddonCodes.has(addon.code);
                    const selected = addons.includes(addon.code);
                    const displayCents = addonCheckoutDisplayCents(
                      addon,
                      addonGatePlan,
                      addonDisplayCycle,
                    );
                    const cycleSuffix = addonPriceCycleSuffix(
                      addon,
                      addonDisplayCycle,
                    );
                    const priceLabel =
                      money(displayCents, addon.currency || "USD") +
                      (cycleSuffix && cycleSuffix !== "one-time"
                        ? ` ${cycleSuffix}`
                        : "");
                    if (owned) {
                      return (
                        <AddonOfferCard
                          key={addon.code}
                          mode="owned"
                          label={addon.label}
                          description={addon.desc}
                          priceLabel={priceLabel}
                          ownedLabel="Existing add-on"
                        />
                      );
                    }
                    return (
                      <AddonOfferCard
                        key={addon.code}
                        mode="select"
                        label={addon.label}
                        description={addon.desc}
                        priceLabel={priceLabel}
                        selected={selected}
                        disabled={checkoutReturnLocksUI}
                        onPress={() =>
                          setAddons((prev) =>
                            prev.includes(addon.code)
                              ? prev.filter((code) => code !== addon.code)
                              : [...prev, addon.code],
                          )
                        }
                      />
                    );
                  })}
              </div>
            </div>
            <div className={portalUi.panel}>
              <h3 className="font-body text-body-lg font-semibold text-on-surface">
                Order summary
              </h3>
              <div className="mt-4 space-y-2 font-body-sm text-body-sm">
                {selectedPlan ? (
                  <div className="flex items-center justify-between text-on-surface">
                    <span className="font-medium">
                      {selectedPlan.name}{" "}
                      <span className="text-on-surface-variant">
                        (
                        {planIsOneTimeOnly(selectedPlan)
                          ? "one-time"
                          : billingCycle}
                        )
                      </span>
                    </span>
                    <span className="font-semibold">
                      {money(selectedPlanAmount, selectedPlan.currency)}
                    </span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-on-surface/15 bg-surface-container-low px-3 py-2 text-on-surface-variant">
                    Select a plan above to see pricing.
                  </div>
                )}
                {addons.length > 0 ? (
                  <p className={portalUi.addonSectionEyebrow + " pt-2"}>
                    Add-ons
                  </p>
                ) : null}
                {addons.map((code) => {
                  const item = addonByCode.get(code);
                  if (!item) return null;
                  return (
                    <div
                      key={code}
                      className="flex items-center justify-between text-on-surface"
                    >
                      <span>{item.label}</span>
                      <span className="font-medium">
                        {money(
                          addonCheckoutDisplayCents(
                            item,
                            addonGatePlan,
                            addonDisplayCycle,
                          ),
                          item.currency || "USD",
                        )}
                      </span>
                    </div>
                  );
                })}
                <div className="mt-3 border-t border-on-surface/10 pt-3">
                  <div className="flex items-center justify-between font-body text-body-lg font-semibold text-on-surface">
                    <span>Total due today</span>
                    <span>
                      {money(
                        selectedPlanAmount + addonsTotal,
                        selectedPlan?.currency,
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={
                  !selectedPlan ||
                  busy ||
                  checkoutReturnLocksUI ||
                  (hasLiveProjectPlan &&
                    (isDowngradeSelection || nothingToApplyLive))
                }
                onClick={() => {
                  if (checkoutReturnLocksUI) return;
                  void (hasLiveProjectPlan
                    ? onApplySubscriptionChanges()
                    : onSecureCheckout());
                }}
                className={portalUi.btnPrimary + " mt-6 w-full !py-3 !text-sm"}
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
              <p className="mt-2 text-center font-caption text-caption text-on-surface-variant">
                Secure checkout powered by Stripe
              </p>
            </div>
          </section>
        </div>
      )}
      <AddonNotAvailableModal
        open={addonNotAvailableOpen}
        onClose={() => setAddonNotAvailableOpen(false)}
        projectId={ownedProject.id}
      />

      <ExtraEditPurchaseModal
        open={extraEditModalOpen}
        onClose={() => {
          setExtraEditModalOpen(false);
          setExtraEditCompanionCodes([]);
        }}
        projectId={ownedProject.id}
        projectName={ownedProject.name}
        plan={planForExtraEditModal}
        usage={ownedProject.usage ?? undefined}
        singleAddon={subExtraEditSingle}
        bundleAddon={subExtraEditBundle}
        companionAddonCodes={extraEditCompanionCodes}
        currency={
          subExtraEditSingle?.currency || subExtraEditBundle?.currency || "USD"
        }
        perEditCents={subModalPerEditCents}
        bundleCredits={subModalBundleCredits}
        bundleCents={subModalBundleCents}
        busy={busy}
        setBusy={setBusy}
        onNotice={setNotice}
        baseReturnUrl={`${window.location.origin}/projects/${ownedProject.id}`}
      />
    </div>
  );
}
