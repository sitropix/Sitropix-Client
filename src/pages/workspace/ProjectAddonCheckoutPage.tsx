import { AddonOrderReview } from "@/components/billing/AddonOrderReview";
import { formatBillingApiError } from "@/lib/billingErrors";
import { getProjectById, hasValidProjectPlan } from "@/services/projectsStore";
import {
  clearAddonCheckoutCart,
  readAddonCheckoutCart,
} from "@/services/addonCheckoutCart";
import {
  confirmAddonCheckoutSession,
  createAddonCheckoutSession,
  ensureBillingCustomer,
} from "@/services/subscriptionsApi";
import { useUser } from "@/context/UserContext";
import { useAuth } from "@/context/AuthContext";
import type { ProjectRecord } from "@/types/project";
import type { SubscriptionAddon } from "@/types/subscription";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SxPageHeader } from "@/components/sx/PageHeader";

export function ProjectAddonCheckoutPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { portal } = useUser();
  const userId = user?.id ?? portal?.user?.id ?? "guest-user";
  const addonCatalog = useMemo(() => portal?.addons ?? [], [portal?.addons]);

  const [rawProject, setRawProject] = useState<ProjectRecord | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [billingPreparing, setBillingPreparing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const returnHandledRef = useRef<string | null>(null);

  const cart = useMemo(() => readAddonCheckoutCart(projectId), [projectId]);

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

  useEffect(() => {
    if (addonFunnel !== "addon_checkout_return") return;
    if (!addonSessionId || !ownedProject) return;
    if (returnHandledRef.current === addonSessionId) return;
    returnHandledRef.current = addonSessionId;
    void (async () => {
      try {
        await confirmAddonCheckoutSession(projectId, addonSessionId);
        clearAddonCheckoutCart();
        navigate(
          {
            pathname: "/projects",
            search: "?payment_success=1&payment_source=addon",
          },
          { replace: true },
        );
      } catch (err) {
        setCheckoutError(
          err instanceof Error
            ? err.message
            : "Couldn't confirm add-on purchase.",
        );
        setSearchParams({}, { replace: true });
      }
    })();
  }, [
    addonFunnel,
    addonSessionId,
    ownedProject,
    projectId,
    navigate,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!ownedProject || !cart || !hasValidProjectPlan(ownedProject)) return;
    let cancelled = false;
    setBillingPreparing(true);
    setCheckoutError(null);
    void ensureBillingCustomer(ownedProject.id)
      .catch((err) => {
        if (!cancelled) {
          setCheckoutError(
            formatBillingApiError(
              err,
              "Couldn't prepare billing for this purchase.",
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setBillingPreparing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownedProject?.id, cart?.addonCodes.join(",")]);

  if (!cart && !projectLoading) {
    return <Navigate to={`/projects/${projectId}/add-ons`} replace />;
  }

  if (!ownedProject && !projectLoading) {
    return <Navigate to="/projects" replace />;
  }

  if (!ownedProject || !cart) {
    return (
      <p className="text-sx-sm text-[var(--text-tertiary)]">
        Loading checkout…
      </p>
    );
  }

  const project = ownedProject;
  const checkoutCart = cart;
  const hasValidPlan = hasValidProjectPlan(project);
  const addonsPath = `/projects/${project.id}/add-ons`;
  const checkoutReturnUrl = `${window.location.origin}${addonsPath}/checkout`;

  const breakdownAddon: SubscriptionAddon | null =
    checkoutCart.addonCodes
      .map((code) => addonCatalog.find((a) => a.code === code))
      .find(
        (a) => a?.billingKind === "recurring" && (a.setupFeeCents ?? 0) > 0,
      ) ?? null;

  async function completePurchase() {
    if (!hasValidPlan) {
      navigate(`/projects/${project.id}/plan`);
      return;
    }
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      await ensureBillingCustomer(project.id);
      const { url } = await createAddonCheckoutSession(
        project.id,
        checkoutCart.addonCodes,
        {
          successUrl: checkoutReturnUrl,
          cancelUrl: checkoutReturnUrl,
          extraEditCheckout: checkoutCart.extraEditCheckout,
          addonRecurringCycle: checkoutCart.addonRecurringCycle,
        },
      );
      if (!url) {
        setCheckoutError("Couldn't start checkout.");
        return;
      }
      window.location.assign(url);
    } catch (err) {
      setCheckoutError(formatBillingApiError(err, "Couldn't start checkout."));
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <div data-sx-root className="flex flex-col gap-6 pb-12">
      <SxPageHeader
        eyebrow={
          <Link to={addonsPath} className="hover:text-[var(--text-brand)]">
            ← Add-ons
          </Link>
        }
        title="Review your order"
        description="Confirm the items and complete payment securely with Stripe."
      />

      {!hasValidPlan ? (
        <div className="rounded-sx-md border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-bg)] px-4 py-3 text-sx-sm text-[var(--color-warning-fg)]">
          Subscribe to a plan before purchasing add-ons.{" "}
          <Link
            to={`/projects/${project.id}/plan`}
            className="font-semibold underline"
          >
            Choose a plan
          </Link>
        </div>
      ) : null}

      <AddonOrderReview
        project={project}
        lineItems={checkoutCart.lineItems}
        dueTodayCents={checkoutCart.dueTodayCents}
        currency={checkoutCart.currency}
        breakdownAddon={breakdownAddon}
        busy={checkoutBusy}
        preparing={billingPreparing}
        errorMessage={checkoutError}
        onBack={() => navigate(addonsPath)}
        onConfirm={() => void completePurchase()}
      />
    </div>
  );
}
