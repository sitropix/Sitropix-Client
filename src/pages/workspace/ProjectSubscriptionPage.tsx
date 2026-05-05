import { Breadcrumb } from "@/components/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  activateProjectSubscription,
  getProjectById,
  REQUIRED_PROJECT_ASSETS,
} from "@/services/projectsStore";
import {
  createCheckoutSession,
  fetchCustomerPortal,
  fetchProjectAssets,
  syncFromStripe,
} from "@/services/subscriptionsApi";
import type { BillingCycle } from "@/types/subscription";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ProjectRecord } from "@/types/project";

const PROJECT_CHECKOUT_INTENT_KEY = "sitropix_project_checkout_intent_v1";

type ProjectCheckoutIntent = {
  projectId: string;
  planId: string;
  billingCycle: BillingCycle;
  addons: string[];
  startedAt: number;
};

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function ProjectSubscriptionPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { portal } = useUser();
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
  const ownedProject = project && project.ownerUserId === userId ? project : null;
  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );
  const addonByCode = useMemo(() => new Map(addonCatalog.map((addon) => [addon.code, addon])), [addonCatalog]);

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
        const value = REQUIRED_PROJECT_ASSETS.every((req) =>
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

  const selectedPlanAmount = selectedPlan ? (billingCycle === "monthly" ? selectedPlan.priceMonthlyCents : selectedPlan.priceYearlyCents) : 0;
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
    checkoutReturnHandledRef.current = runKey;
    if (Date.now() - intent.startedAt > 2 * 60 * 60 * 1000) {
      window.localStorage.removeItem(PROJECT_CHECKOUT_INTENT_KEY);
      setNotice("Checkout intent expired. Please try payment again.");
      return;
    }

    setSelectedPlanId((prev) => (prev === intent.planId ? prev : intent.planId));
    setBillingCycle((prev) => (prev === intent.billingCycle ? prev : intent.billingCycle));
    setAddons((prev) => {
      const next = intent?.addons ?? [];
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
      return next;
    });
    setBusy(true);
    setNotice("Verifying Stripe payment...");
    void (async () => {
      try {
        await syncFromStripe({ projectId: ownedProject.id });
        const portalPayload = await fetchCustomerPortal({ projectId: ownedProject.id });
        const stripeSub = portalPayload.subscription;
        const stripePeriodEnd = stripeSub?.currentPeriodEnd ?? null;
        const isPaidState = stripeSub?.status === "active" || stripeSub?.status === "trialing";
        if (!stripeSub || !isPaidState || !stripePeriodEnd) {
          setNotice("Stripe payment not confirmed yet. Complete checkout and retry.");
          return;
        }
        if (stripeSub.planId !== intent.planId) {
          setNotice("Stripe subscription plan mismatch. Please retry checkout with the selected plan.");
          return;
        }
        const planForAmount = portalPayload.plans.find((p) => p.id === intent.planId) ?? null;
        const intentAddonsTotal = (intent.addons ?? []).reduce((sum, code) => {
          const item = addonByCode.get(code);
          return sum + (item?.priceCents ?? 0);
        }, 0);
        const baseAmount =
          intent.billingCycle === "monthly"
            ? (planForAmount?.priceMonthlyCents ?? 0)
            : (planForAmount?.priceYearlyCents ?? 0);
        await activateProjectSubscription(ownedProject.id, {
          planId: intent.planId,
          planName: planForAmount?.name ?? "Plan",
          billingCycle: intent.billingCycle,
          amountCents: baseAmount + intentAddonsTotal,
          currency: planForAmount?.currency || "USD",
          planValidUntil: stripePeriodEnd,
          addons: intent.addons ?? [],
        });
        window.localStorage.removeItem(PROJECT_CHECKOUT_INTENT_KEY);
        setNotice(null);
        navigate(`/projects/${ownedProject.id}`, { replace: true });
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Failed to verify Stripe payment.");
      } finally {
        setBusy(false);
      }
    })();
  }, [funnelState, ownedProject?.id, navigate, addonByCode]);

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
        <>
          <div className="mx-auto inline-flex rounded-full border border-[#2A3037] bg-[#1C2126] p-1">
            {(["monthly", "yearly"] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  billingCycle === cycle
                    ? "bg-white text-canvas"
                    : "text-zinc-300 hover:text-white"
                }`}
              >
                {cycle === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => {
              const active = selectedPlanId === plan.id;
              const amount =
                billingCycle === "monthly"
                  ? plan.priceMonthlyCents
                  : plan.priceYearlyCents;
              return (
                <article
                  key={plan.id}
                  className={`rounded-2xl border p-5 shadow-glass transition ${
                    active
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
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`mt-4 w-full rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-white text-canvas hover:bg-zinc-100"
                        : "bg-[#2A3037] text-white hover:bg-[#343B45]"
                    }`}
                  >
                    {active ? "Selected" : "Select plan"}
                  </button>
                </article>
              );
            })}
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-2xl border border-[#2A3037] bg-[#15191C] p-5">
              <h3 className="text-xl font-semibold text-white">Enhance Your Plan</h3>
              <p className="mt-1 text-sm text-zinc-400">Add powerful extras to accelerate your project.</p>
              <div className="mt-4 space-y-3">
                {addonCatalog.map((addon) => {
                  const selected = addons.includes(addon.code);
                  return (
                    <button
                      key={addon.code}
                      type="button"
                      onClick={() =>
                        setAddons((prev) =>
                          prev.includes(addon.code) ? prev.filter((code) => code !== addon.code) : [...prev, addon.code],
                        )
                      }
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
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
                      {selectedPlan.name} <span className="text-zinc-400">({billingCycle})</span>
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
                disabled={!selectedPlan || busy}
                onClick={() => void onSecureCheckout()}
                className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-canvas transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy ? "Processing..." : "Proceed to Pay"}
              </button>
              <p className="mt-2 text-center text-xs text-zinc-500">Secure checkout powered by Stripe</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
