import {
  AddonBillingCycleToggle,
  AddonOfferCard,
} from "@/components/billing/addonDisplay";
import { ExtraEditPurchaseModal } from "@/components/billing/ExtraEditPurchaseModal";
import {
  canOfferExtraEditPurchases,
  isCreditPackAddon,
  readExtraEditPricingForPlan,
  resolveExtraEditPurchaseAddons,
} from "@/constants/extraEditAddons";
import {
  addonCardDisplayCents,
  addonCategoryLabel,
  defaultAddonRecurringCycle,
  extraEditAddonCaption,
  formatAddonMoney,
  isAddonCheckoutEligible,
  isAddonRecurring,
  isRecurringSetupAddon,
  projectAddonCardPriceCents,
  projectAddonPriceSuffix,
} from "@/lib/addonDisplayHelpers";
import { maxPurchasableExtraEditCredits } from "@/lib/websiteEditCreditsLimit";
import { getProjectById, hasValidProjectPlan } from "@/services/projectsStore";
import {
  buildAddonCheckoutCartFromAddons,
  saveAddonCheckoutCart,
} from "@/services/addonCheckoutCart";
import { confirmAddonCheckoutSession } from "@/services/subscriptionsApi";
import type { BillingCycle } from "@/types/subscription";
import type { ProjectAddonCard, ProjectRecord } from "@/types/project";
import type { SubscriptionAddon } from "@/types/subscription";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SxButton } from "@/components/sx/Button";
import { SxPageHeader } from "@/components/sx/PageHeader";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";

export function ProjectManageAddonsPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { portal } = useUser();
  const toast = useSxToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = user?.id ?? portal?.user?.id ?? "guest-user";

  const addonCatalog = useMemo(() => portal?.addons ?? [], [portal?.addons]);
  const plans = useMemo(() => portal?.plans ?? [], [portal?.plans]);

  const [rawProject, setRawProject] = useState<ProjectRecord | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [selectedCart, setSelectedCart] = useState<string[]>([]);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [extraEditModalOpen, setExtraEditModalOpen] = useState(false);
  const [addonRecurringCycle, setAddonRecurringCycle] =
    useState<BillingCycle>("monthly");
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
    if (!addonSessionId || !addonProjectParam || addonProjectParam !== projectId)
      return;
    if (addonReturnHandledRef.current === addonSessionId) return;
    addonReturnHandledRef.current = addonSessionId;
    void (async () => {
      try {
        await confirmAddonCheckoutSession(projectId, addonSessionId);
        navigate(
          {
            pathname: "/projects",
            search: "?payment_success=1&payment_source=addon",
          },
          { replace: true },
        );
      } catch (err) {
        toast.error(
          "Couldn't confirm add-on purchase.",
          err instanceof Error ? err.message : undefined,
        );
        setSearchParams({}, { replace: true });
      }
    })();
  }, [
    addonFunnel,
    addonSessionId,
    addonProjectParam,
    projectId,
    navigate,
    setSearchParams,
    toast,
  ]);

  const purchasableAddons = useMemo(
    () => addonCatalog.filter((a) => !isCreditPackAddon(a)),
    [addonCatalog],
  );

  const accessible = ownedProject?.accessibleAddons;
  const existingCards = accessible?.existing ?? [];
  const purchasableCards = accessible?.purchasable ?? [];
  const canChooseAddonCycle =
    accessible?.billingContext?.canChooseRecurringAddonCycle ?? false;

  const addonByCode = useMemo(
    () => new Map(purchasableAddons.map((a) => [a.code, a])),
    [purchasableAddons],
  );

  const cardByCode = useMemo(() => {
    const map = new Map<string, ProjectAddonCard>();
    for (const card of [...existingCards, ...purchasableCards]) {
      map.set(card.code, card);
    }
    return map;
  }, [existingCards, purchasableCards]);

  useEffect(() => {
    if (!ownedProject) return;
    setAddonRecurringCycle(
      defaultAddonRecurringCycle(ownedProject.billingCycle, purchasableCards),
    );
  }, [ownedProject?.id, ownedProject?.billingCycle, purchasableCards]);

  const availableForCart = useMemo(
    () =>
      purchasableCards
        .map((card) => addonByCode.get(card.code))
        .filter((a): a is SubscriptionAddon => Boolean(a))
        .filter((a) => isAddonCheckoutEligible(a)),
    [purchasableCards, addonByCode],
  );

  const activeAddons = useMemo(
    () =>
      existingCards
        .map((card) => addonByCode.get(card.code))
        .filter((a): a is SubscriptionAddon => Boolean(a)),
    [existingCards, addonByCode],
  );

  const effectiveAddonCycle: BillingCycle = canChooseAddonCycle
    ? addonRecurringCycle
    : ownedProject?.billingCycle === "yearly"
      ? "yearly"
      : "monthly";

  const selectedCartAddons = useMemo(
    () =>
      selectedCart
        .map((code) => addonByCode.get(code))
        .filter((a): a is SubscriptionAddon => Boolean(a)),
    [selectedCart, addonByCode],
  );

  const cartTotalCents = useMemo(() => {
    const plan = plans.find((p) => p.id === ownedProject?.planId) ?? null;
    return selectedCartAddons.reduce((sum, addon) => {
      const card = cardByCode.get(addon.code);
      return (
        sum +
        (card
          ? projectAddonCardPriceCents(card, addon, plan, effectiveAddonCycle)
          : addonCardDisplayCents(
              addon,
              plans,
              ownedProject?.planId,
              effectiveAddonCycle,
            ))
      );
    }, 0);
  }, [
    selectedCartAddons,
    cardByCode,
    effectiveAddonCycle,
    plans,
    ownedProject?.planId,
  ]);

  if (!ownedProject && !projectLoading) {
    return <Navigate to="/projects" replace />;
  }
  if (!ownedProject) {
    return (
      <p className="text-sx-sm text-[var(--text-tertiary)]">
        Loading add-ons…
      </p>
    );
  }

  const project = ownedProject;
  const hasValidPlan = hasValidProjectPlan(project);
  const planForProject = plans.find((p) => p.id === project.planId) ?? null;
  const { single: extraEditSingle, bundle: extraEditBundle } =
    resolveExtraEditPurchaseAddons(addonCatalog, planForProject);
  const { perEditCents, bundleCredits, bundleCents } =
    readExtraEditPricingForPlan(planForProject, extraEditSingle, extraEditBundle);
  const maxExtraEdits = maxPurchasableExtraEditCredits(
    project.usage,
    planForProject,
  );
  const canBuyExtraEdits =
    hasValidPlan &&
    canOfferExtraEditPurchases(planForProject, addonCatalog) &&
    maxExtraEdits > 0;

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

      if (isAddonRecurring(addon)) {
        const withoutRecurring = prev.filter((c) => {
          const row = addonByCode.get(c);
          return row == null || !isAddonRecurring(row);
        });
        return [...withoutRecurring, code];
      }

      return [...prev, code];
    });
  }

  function openCartReview() {
    if (!hasValidPlan) {
      navigate(`/projects/${project.id}/plan`);
      return;
    }
    if (selectedCartAddons.length === 0) return;
    const checkoutReturnUrl = `${window.location.origin}/projects/${project.id}/add-ons/checkout`;
    const cart = buildAddonCheckoutCartFromAddons({
      project,
      addons: selectedCartAddons,
      plans,
      returnUrl: checkoutReturnUrl,
    });
    saveAddonCheckoutCart({
      ...cart,
      ...(canChooseAddonCycle
        ? { addonRecurringCycle: effectiveAddonCycle }
        : {}),
    });
    navigate(`/projects/${project.id}/add-ons/checkout`);
  }

  return (
    <div data-sx-root className="flex flex-col gap-6 pb-28">
      <SxPageHeader
        eyebrow={
          <Link
            to={`/projects/${project.id}`}
            className="hover:text-[var(--text-brand)]"
          >
            ← {project.name}
          </Link>
        }
        title="Manage add-ons"
        description="Active add-ons bill with your subscription. One-time upgrades are charged at checkout."
      />

      {!hasValidPlan ? (
        <div className="rounded-sx-md border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-bg)] px-4 py-3 text-sx-sm text-[var(--color-warning-fg)]">
          Subscribe to a plan to purchase add-ons.{" "}
          <Link
            to={`/projects/${project.id}/plan`}
            className="font-semibold underline"
          >
            Choose a plan
          </Link>
        </div>
      ) : null}

      {canBuyExtraEdits ? (
        <SxPanel
          title="Edit credits"
          action={
            <SxButton
              variant="primary"
              size="sm"
              disabled={checkoutBusy}
              onClick={() => setExtraEditModalOpen(true)}
            >
              Buy credits
            </SxButton>
          }
        >
          <p className="text-sx-sm text-[var(--text-secondary)]">
            Buy more edit credits for this billing cycle.
          </p>
        </SxPanel>
      ) : null}

      {activeAddons.length > 0 ? (
        <SxPanel title="Active add-ons">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeAddons.map((addon) => {
              const card = cardByCode.get(addon.code);
              const cycle =
                project.billingCycle === "yearly" ? "yearly" : "monthly";
              const priceCents = card
                ? projectAddonCardPriceCents(card, addon, planForProject, cycle)
                : addonCardDisplayCents(addon, plans, project.planId, cycle);
              const suffix = projectAddonPriceSuffix(addon, cycle);
              return (
                <AddonOfferCard
                  key={addon.code}
                  mode="active"
                  label={addon.label}
                  description={addon.desc}
                  priceLabel={formatAddonMoney(
                    priceCents,
                    addon.currency || "USD",
                  )}
                  priceSuffix={suffix}
                  categoryTag={addonCategoryLabel(addon)}
                  onManage={() => navigate("/billing")}
                />
              );
            })}
          </div>
        </SxPanel>
      ) : null}

      {availableForCart.length > 0 ? (
        <SxPanel
          title="Available add-ons"
          action={
            canChooseAddonCycle ? (
              <AddonBillingCycleToggle
                value={addonRecurringCycle}
                onChange={setAddonRecurringCycle}
                disabled={checkoutBusy}
              />
            ) : null
          }
        >
          <p className="mb-4 text-sx-sm text-[var(--text-secondary)]">
            One-time add-ons combine freely. Only one recurring add-on per checkout (setup-fee add-ons must be purchased alone).
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {availableForCart.map((addon) => {
              const selected = selectedCart.includes(addon.code);
              const card = cardByCode.get(addon.code);
              const priceCents = card
                ? projectAddonCardPriceCents(
                    card,
                    addon,
                    planForProject,
                    effectiveAddonCycle,
                  )
                : addonCardDisplayCents(
                    addon,
                    plans,
                    project.planId,
                    effectiveAddonCycle,
                  );
              const suffix = projectAddonPriceSuffix(
                addon,
                effectiveAddonCycle,
              );
              const recurringSetup = isRecurringSetupAddon(addon);
              return (
                <AddonOfferCard
                  key={addon.code}
                  mode="select"
                  label={addon.label}
                  description={addon.desc}
                  priceLabel={formatAddonMoney(
                    priceCents,
                    addon.currency || "USD",
                  )}
                  priceSuffix={suffix}
                  caption={
                    recurringSetup
                      ? "Setup + first cycle · select alone"
                      : isAddonRecurring(addon)
                        ? "One recurring add-on per checkout"
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
        </SxPanel>
      ) : null}

      {activeAddons.length === 0 &&
      availableForCart.length === 0 &&
      !canBuyExtraEdits ? (
        <SxPanel>
          <p className="text-sx-sm text-[var(--text-secondary)]">
            No add-ons are available for this project right now.
          </p>
        </SxPanel>
      ) : null}

      {/* Sticky cart bar */}
      {selectedCartAddons.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 shadow-sx-lg md:left-64">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-brand-50)] text-[var(--color-brand-700)] font-mono text-sx-xs font-bold">
                {selectedCartAddons.length}
              </span>
              <div className="min-w-0">
                <p className="truncate font-ui text-sx-sm font-semibold text-[var(--text-primary)]">
                  {selectedCartAddons.length} item
                  {selectedCartAddons.length === 1 ? "" : "s"} selected
                </p>
                <p className="truncate font-mono text-sx-xs text-[var(--text-tertiary)]">
                  {formatAddonMoney(
                    cartTotalCents,
                    selectedCartAddons[0]?.currency || "USD",
                  )}{" "}
                  due today
                </p>
              </div>
            </div>
            <SxButton
              variant="primary"
              disabled={checkoutBusy}
              onClick={openCartReview}
            >
              Review &amp; checkout
            </SxButton>
          </div>
        </div>
      ) : null}

      <ExtraEditPurchaseModal
        open={extraEditModalOpen}
        onClose={() => setExtraEditModalOpen(false)}
        projectId={project.id}
        projectName={project.name}
        plan={planForProject}
        usage={project.usage ?? undefined}
        singleAddon={extraEditSingle}
        bundleAddon={extraEditBundle}
        currency={
          extraEditSingle?.currency || extraEditBundle?.currency || "USD"
        }
        perEditCents={perEditCents}
        bundleCredits={bundleCredits}
        bundleCents={bundleCents}
        busy={checkoutBusy}
        setBusy={setCheckoutBusy}
        onNotice={(msg) => msg && toast.error(msg)}
        baseReturnUrl={`${window.location.origin}/projects/${project.id}/add-ons`}
      />
    </div>
  );
}
