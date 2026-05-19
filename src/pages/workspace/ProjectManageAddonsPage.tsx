import { Breadcrumb } from "@/components/Breadcrumb";
import { AddonOfferCard } from "@/components/billing/addonDisplay";
import { AddonPurchaseDialog } from "@/components/billing/AddonPurchaseDialog";
import { ExtraEditPurchaseModal } from "@/components/billing/ExtraEditPurchaseModal";
import { MaterialIcon } from "@/components/MaterialIcon";
import { portal as portalUi } from "@/components/portal/portalStyles";
import {
  canOfferExtraEditPurchases,
  isCreditPackAddon,
  readExtraEditPricingForPlan,
  resolveExtraEditPurchaseAddons,
} from "@/constants/extraEditAddons";
import { formatBillingApiError } from "@/lib/billingErrors";
import {
  addonCardDisplayCents,
  addonCategoryLabel,
  addonRecurringMonthlyCents,
  extraEditAddonCaption,
  formatAddonMoney,
  isAddonCheckoutEligible,
  isAddonRecurring,
  isRecurringSetupAddon,
} from "@/lib/addonDisplayHelpers";
import { maxPurchasableExtraEditCredits } from "@/lib/websiteEditCreditsLimit";
import { getProjectById, hasValidProjectPlan } from "@/services/projectsStore";
import {
  confirmAddonCheckoutSession,
  createAddonCheckoutSession,
  ensureBillingCustomer,
} from "@/services/subscriptionsApi";
import type { ProjectRecord } from "@/types/project";
import type { SubscriptionAddon } from "@/types/subscription";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

export function ProjectManageAddonsPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { portal } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = user?.id ?? portal?.user?.id ?? "guest-user";

  const addonCatalog = useMemo(() => portal?.addons ?? [], [portal?.addons]);
  const plans = useMemo(() => portal?.plans ?? [], [portal?.plans]);

  const [rawProject, setRawProject] = useState<ProjectRecord | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [selectedCart, setSelectedCart] = useState<string[]>([]);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [extraEditModalOpen, setExtraEditModalOpen] = useState(false);
  const [purchaseTarget, setPurchaseTarget] = useState<SubscriptionAddon | null>(null);
  const [purchaseTargets, setPurchaseTargets] = useState<SubscriptionAddon[]>([]);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [billingPreparing, setBillingPreparing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const addonReturnHandledRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProjectLoading(true);
    void getProjectById(projectId)
      .then((row) => {
        if (!cancelled) setRawProject(row);
      })
      .finally(() => {
        if (!cancelled) setProjectLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const ownedProject =
    rawProject && rawProject.ownerUserId === userId ? rawProject : null;

  const addonFunnel = searchParams.get("subscriptionFunnel");
  const addonSessionId = searchParams.get("session_id");
  const addonProjectParam = searchParams.get("projectId");

  useEffect(() => {
    if (addonFunnel !== "addon_checkout_return") return;
    if (!addonSessionId || !addonProjectParam || addonProjectParam !== projectId) return;
    if (addonReturnHandledRef.current === addonSessionId) return;
    addonReturnHandledRef.current = addonSessionId;
    void (async () => {
      try {
        await confirmAddonCheckoutSession(projectId, addonSessionId);
        navigate(
          { pathname: "/projects", search: "?payment_success=1&payment_source=addon" },
          { replace: true },
        );
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Could not confirm add-on purchase.");
        setSearchParams({}, { replace: true });
      }
    })();
  }, [addonFunnel, addonSessionId, addonProjectParam, projectId, navigate, setSearchParams]);

  useEffect(() => {
    const target = purchaseTarget ?? (purchaseTargets.length === 1 ? purchaseTargets[0] : null);
    if (!target || !ownedProject || !hasValidProjectPlan(ownedProject)) return;
    let cancelled = false;
    setBillingPreparing(true);
    setCheckoutError(null);
    void ensureBillingCustomer(ownedProject.id)
      .catch((err) => {
        if (!cancelled) {
          setCheckoutError(
            formatBillingApiError(err, "Could not prepare billing for this purchase."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setBillingPreparing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [purchaseTarget?.code, purchaseTargets.map((a) => a.code).join(","), ownedProject?.id]);

  const purchasableAddons = useMemo(
    () => addonCatalog.filter((a) => !isCreditPackAddon(a)),
    [addonCatalog],
  );

  const ownedCodes = useMemo(() => new Set(ownedProject?.addons ?? []), [ownedProject?.addons]);

  const activeAddons = useMemo(
    () => purchasableAddons.filter((a) => ownedCodes.has(a.code)),
    [purchasableAddons, ownedCodes],
  );

  const addonByCode = useMemo(
    () => new Map(purchasableAddons.map((a) => [a.code, a])),
    [purchasableAddons],
  );

  /** Shown in the selectable grid (one-time + recurring with setup fee). */
  const availableForCart = useMemo(
    () =>
      purchasableAddons.filter(
        (a) => !ownedCodes.has(a.code) && isAddonCheckoutEligible(a),
      ),
    [purchasableAddons, ownedCodes],
  );

  /** Plain recurring — must be added when starting or changing subscription. */
  const subscriptionOnlyRecurring = useMemo(
    () =>
      purchasableAddons.filter(
        (a) =>
          !ownedCodes.has(a.code) &&
          isAddonRecurring(a) &&
          !isAddonCheckoutEligible(a),
      ),
    [purchasableAddons, ownedCodes],
  );

  const popularCartCode =
    availableForCart.find((a) => isRecurringSetupAddon(a))?.code ??
    availableForCart[0]?.code ??
    null;

  const selectedCartAddons = useMemo(
    () =>
      selectedCart
        .map((code) => addonByCode.get(code))
        .filter((a): a is SubscriptionAddon => Boolean(a)),
    [selectedCart, addonByCode],
  );

  const cartTotalCents = useMemo(
    () =>
      selectedCartAddons.reduce(
        (sum, addon) =>
          sum + addonCardDisplayCents(addon, plans, ownedProject?.planId),
        0,
      ),
    [selectedCartAddons, plans, ownedProject?.planId],
  );

  if (!ownedProject && !projectLoading) {
    return <Navigate to="/projects" replace />;
  }
  if (!ownedProject) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Loading add-ons…</p>;
  }

  const project = ownedProject;
  const hasValidPlan = hasValidProjectPlan(project);
  const planForProject = plans.find((p) => p.id === project.planId) ?? null;
  const { single: extraEditSingle, bundle: extraEditBundle } = resolveExtraEditPurchaseAddons(
    addonCatalog,
    planForProject,
  );
  const { perEditCents, bundleCredits, bundleCents } = readExtraEditPricingForPlan(
    planForProject,
    extraEditSingle,
    extraEditBundle,
  );
  const maxExtraEdits = maxPurchasableExtraEditCredits(project.usage, planForProject);
  const canBuyExtraEdits =
    hasValidPlan &&
    canOfferExtraEditPurchases(planForProject, addonCatalog) &&
    maxExtraEdits > 0;

  const reviewOpen = purchaseTarget !== null || purchaseTargets.length > 0;
  const reviewAddons = purchaseTargets.length > 0 ? purchaseTargets : purchaseTarget ? [purchaseTarget] : [];
  const reviewPrimary = purchaseTarget ?? reviewAddons[0] ?? null;
  const reviewDueCents = reviewAddons.reduce(
    (sum, a) => sum + addonCardDisplayCents(a, plans, project.planId),
    0,
  );
  const reviewCurrency = reviewPrimary?.currency || "USD";

  async function startStripeCheckout(codes: string[]) {
    if (!hasValidPlan || codes.length === 0) return;
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      await ensureBillingCustomer(project.id);
      const base = `${window.location.origin}/projects/${project.id}/add-ons`;
      const { url } = await createAddonCheckoutSession(project.id, codes, {
        successUrl: base,
        cancelUrl: base,
      });
      if (!url) {
        setCheckoutError("Could not start checkout.");
        return;
      }
      window.location.assign(url);
    } catch (err) {
      setCheckoutError(formatBillingApiError(err, "Could not start checkout."));
    } finally {
      setCheckoutBusy(false);
    }
  }

  function toggleCartSelection(code: string) {
    const addon = addonByCode.get(code);
    if (!addon) return;

    setSelectedCart((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);

      if (isRecurringSetupAddon(addon)) {
        return [code];
      }

      const hasRecurringSetup = prev.some((c) => {
        const row = addonByCode.get(c);
        return row != null && isRecurringSetupAddon(row);
      });
      if (hasRecurringSetup) {
        return [code];
      }

      return [...prev, code];
    });
  }

  function openCartReview() {
    if (!hasValidPlan) {
      navigate(`/projects/${project.id}/subscription`);
      return;
    }
    if (selectedCartAddons.length === 0) return;
    setPurchaseTarget(null);
    setPurchaseTargets(selectedCartAddons);
    setCheckoutError(null);
  }

  return (
    <div className="client-workspace-view relative space-y-10 pb-28">
      <Breadcrumb
        items={[
          { label: "Home", to: "/dashboard" },
          { label: "My Projects", to: "/projects" },
          { label: project.name, to: `/projects/${project.id}` },
          { label: "Add-ons" },
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-h1 text-h1 font-bold text-on-surface">Manage Add-ons</h1>
          <p className="mt-2 font-body text-body text-on-surface-variant">
            Enhance your project with powerful extras. Active add-ons are billed with your subscription;
            one-time upgrades are charged at checkout.
          </p>
        </div>
        <Link
          to={`/projects/${project.id}`}
          className={
            portalUi.btnSecondary +
            " inline-flex items-center gap-2 !rounded-lg !px-4 !py-2.5 !text-sm"
          }
        >
          <MaterialIcon name="arrow_back" className="!text-[18px]" />
          Back to Dashboard
        </Link>
      </header>

      {notice ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-body-sm text-body-sm text-amber-900">
          {notice}
        </p>
      ) : null}

      {!hasValidPlan ? (
        <p className="rounded-lg border border-accent-gold/25 bg-gold-light/40 px-4 py-3 font-body-sm text-body-sm text-on-secondary-container">
          Subscribe to a plan to purchase add-ons.{" "}
          <Link to={`/projects/${project.id}/subscription`} className="font-semibold underline">
            Choose a plan
          </Link>
        </p>
      ) : null}

      {canBuyExtraEdits ? (
        <section className={portalUi.panel}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-body text-body-lg font-semibold text-on-surface">
                Website edit credits
              </h2>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                Purchase additional edit credits for this billing cycle.
              </p>
            </div>
            <button
              type="button"
              disabled={checkoutBusy}
              onClick={() => setExtraEditModalOpen(true)}
              className={portalUi.btnPrimary + " !px-4 !py-2 !text-sm"}
            >
              Purchase edit credits
            </button>
          </div>
        </section>
      ) : null}

      {activeAddons.length > 0 ? (
        <section>
          <h2 className="flex items-center gap-2 font-h2 text-h2 font-bold text-on-surface">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">
              <MaterialIcon name="check_circle" className="!text-[18px]" />
            </span>
            Active Add-ons
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeAddons.map((addon) => (
              <AddonOfferCard
                key={addon.code}
                mode="active"
                label={addon.label}
                description={addon.desc}
                priceLabel={formatAddonMoney(
                  addonRecurringMonthlyCents(addon),
                  addon.currency || "USD",
                )}
                categoryTag={addonCategoryLabel(addon)}
                onManage={() => navigate("/subscription-management")}
              />
            ))}
          </div>
        </section>
      ) : null}

      {availableForCart.length > 0 ? (
        <section>
          <h2 className="font-h2 text-h2 font-bold text-on-surface">Available Upgrades</h2>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Select one or more add-ons, then checkout. One-time services can be combined; recurring
            bolt-ons with a setup fee must be purchased alone per checkout.
          </p>
          <h3 className="mt-6 flex items-center gap-2 font-body font-semibold text-on-surface">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
              <MaterialIcon name="inventory_2" className="!text-[18px]" />
            </span>
            One-Time &amp; Checkout Add-ons
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableForCart.map((addon) => {
              const selected = selectedCart.includes(addon.code);
              const recurringSetup = isRecurringSetupAddon(addon);
              return (
                <AddonOfferCard
                  key={addon.code}
                  mode="select"
                  label={addon.label}
                  description={addon.desc}
                  priceLabel={formatAddonMoney(
                    addonCardDisplayCents(addon, plans, project.planId),
                    addon.currency || "USD",
                  )}
                  caption={
                    recurringSetup
                      ? "Setup + first billing cycle · select alone"
                      : extraEditAddonCaption(addon, plans, project.planId) ||
                        "Combine with other one-time add-ons"
                  }
                  selected={selected}
                  disabled={checkoutBusy || !hasValidPlan}
                  onPress={() => toggleCartSelection(addon.code)}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {subscriptionOnlyRecurring.length > 0 ? (
        <section>
          <h3 className="mt-2 flex items-center gap-2 font-body font-semibold text-on-surface">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-light text-accent-gold">
              <MaterialIcon name="sync" className="!text-[18px]" />
            </span>
            Recurring (via subscription)
          </h3>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            These recurring add-ons are added when you start or change your plan, not from this
            checkout.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {subscriptionOnlyRecurring.map((addon) => (
              <AddonOfferCard
                key={addon.code}
                mode="upgrade"
                popular={addon.code === popularCartCode && subscriptionOnlyRecurring.length > 1}
                label={addon.label}
                description={addon.desc}
                priceLabel={formatAddonMoney(
                  addonRecurringMonthlyCents(addon),
                  addon.currency || "USD",
                )}
                priceSuffix="/month"
                disabled={checkoutBusy}
                actionLabel={hasValidPlan ? "Add via subscription" : "Subscribe to enable"}
                onPress={() => navigate(`/projects/${project.id}/subscription`)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {activeAddons.length === 0 &&
      subscriptionOnlyRecurring.length === 0 &&
      availableForCart.length === 0 &&
      !canBuyExtraEdits ? (
        <p className="rounded-lg border border-on-surface/10 bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">
          No add-ons are available for this project right now.
        </p>
      ) : null}

      {selectedCartAddons.length > 0 ? (
        <div className={portalUi.addonCheckoutBar}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-light text-accent-gold">
              <MaterialIcon name="shopping_cart" className="!text-[22px]" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent-gold text-[10px] font-bold text-white">
                {selectedCartAddons.length}
              </span>
            </span>
            <div className="min-w-0">
              <p className="truncate font-body font-semibold text-on-surface">
                {selectedCartAddons.length} item{selectedCartAddons.length === 1 ? "" : "s"}{" "}
                selected
              </p>
              <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
                {formatAddonMoney(cartTotalCents, selectedCartAddons[0]?.currency || "USD")} due today
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={checkoutBusy}
            onClick={openCartReview}
            className={portalUi.btnPrimary + " shrink-0 !px-5 !py-2.5 !text-sm"}
          >
            Checkout →
          </button>
        </div>
      ) : null}

      <AddonPurchaseDialog
        open={reviewOpen}
        addon={reviewPrimary}
        addons={reviewAddons.length > 1 ? reviewAddons : undefined}
        project={project}
        priceLabel={formatAddonMoney(reviewDueCents, reviewCurrency)}
        dueTodayCents={reviewDueCents}
        currency={reviewCurrency}
        breakdownAddon={reviewPrimary}
        busy={checkoutBusy}
        preparing={billingPreparing}
        errorMessage={checkoutError}
        onClose={() => {
          setPurchaseTarget(null);
          setPurchaseTargets([]);
          setCheckoutError(null);
        }}
        onConfirm={() => {
          const codes = reviewAddons.map((a) => a.code);
          void startStripeCheckout(codes);
        }}
      />

      <ExtraEditPurchaseModal
        open={extraEditModalOpen}
        onClose={() => setExtraEditModalOpen(false)}
        projectId={project.id}
        projectName={project.name}
        plan={planForProject}
        usage={project.usage ?? undefined}
        singleAddon={extraEditSingle}
        bundleAddon={extraEditBundle}
        currency={extraEditSingle?.currency || extraEditBundle?.currency || "USD"}
        perEditCents={perEditCents}
        bundleCredits={bundleCredits}
        bundleCents={bundleCents}
        busy={checkoutBusy}
        setBusy={setCheckoutBusy}
        onNotice={setNotice}
        baseReturnUrl={`${window.location.origin}/projects/${project.id}/add-ons`}
      />
    </div>
  );
}
