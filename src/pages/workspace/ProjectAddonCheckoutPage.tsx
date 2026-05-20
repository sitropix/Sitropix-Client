import { Breadcrumb } from "@/components/Breadcrumb";
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
          { pathname: "/projects", search: "?payment_success=1&payment_source=addon" },
          { replace: true },
        );
      } catch (err) {
        setCheckoutError(err instanceof Error ? err.message : "Could not confirm add-on purchase.");
        setSearchParams({}, { replace: true });
      }
    })();
  }, [addonFunnel, addonSessionId, ownedProject, projectId, navigate, setSearchParams]);

  useEffect(() => {
    if (!ownedProject || !cart || !hasValidProjectPlan(ownedProject)) return;
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
  }, [ownedProject?.id, cart?.addonCodes.join(",")]);

  if (!cart && !projectLoading) {
    return <Navigate to={`/projects/${projectId}/add-ons`} replace />;
  }

  if (!ownedProject && !projectLoading) {
    return <Navigate to="/projects" replace />;
  }

  if (!ownedProject || !cart) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Loading checkout…</p>;
  }

  const project = ownedProject;
  const hasValidPlan = hasValidProjectPlan(project);
  const addonsPath = `/projects/${project.id}/add-ons`;
  const checkoutReturnUrl = `${window.location.origin}${addonsPath}/checkout`;

  const breakdownAddon: SubscriptionAddon | null =
    cart.addonCodes
      .map((code) => addonCatalog.find((a) => a.code === code))
      .find((a) => a?.billingKind === "recurring" && (a.setupFeeCents ?? 0) > 0) ?? null;

  async function completePurchase() {
    if (!hasValidPlan) {
      navigate(`/projects/${project.id}/subscription`);
      return;
    }
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      await ensureBillingCustomer(project.id);
      const { url } = await createAddonCheckoutSession(project.id, cart.addonCodes, {
        successUrl: checkoutReturnUrl,
        cancelUrl: checkoutReturnUrl,
        extraEditCheckout: cart.extraEditCheckout,
        addonRecurringCycle: cart.addonRecurringCycle,
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

  return (
    <div className="client-workspace-view space-y-8 pb-16">
      <Breadcrumb
        items={[
          { label: "Home", to: "/dashboard" },
          { label: "My Projects", to: "/projects" },
          { label: project.name, to: `/projects/${project.id}` },
          { label: "Add-ons", to: addonsPath },
          { label: "Checkout" },
        ]}
      />

      <header>
        <h1 className="font-h1 text-h1 font-bold text-on-surface">Review your order</h1>
        <p className="mt-2 font-body text-body text-on-surface-variant">
          Confirm item details and complete your purchase securely.
        </p>
      </header>

      {!hasValidPlan ? (
        <p className="rounded-lg border border-accent-gold/25 bg-gold-light/40 px-4 py-3 font-body-sm text-body-sm text-on-secondary-container">
          Subscribe to a plan before purchasing add-ons.{" "}
          <Link to={`/projects/${project.id}/subscription`} className="font-semibold underline">
            Choose a plan
          </Link>
        </p>
      ) : null}

      <AddonOrderReview
        project={project}
        lineItems={cart.lineItems}
        dueTodayCents={cart.dueTodayCents}
        currency={cart.currency}
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
