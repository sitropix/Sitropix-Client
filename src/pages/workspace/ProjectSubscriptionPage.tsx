import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useUser } from "@/context/UserContext";
import { activateProjectSubscription, getProjectById, hasAllRequiredAssets } from "@/services/projectsStore";
import type { BillingCycle } from "@/types/subscription";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

export function ProjectSubscriptionPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { portal } = useUser();
  const userId = portal?.user?.id ?? "guest-user";
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const project = getProjectById(projectId);
  const plans = portal?.plans ?? [];
  const selectedPlan = useMemo(() => plans.find((p) => p.id === selectedPlanId) ?? null, [plans, selectedPlanId]);

  if (!project || project.ownerUserId !== userId) return <Navigate to="/projects" replace />;

  const ready = hasAllRequiredAssets(project);

  async function onSecureCheckout() {
    if (!selectedPlan) return;
    setBusy(true);
    const amountCents = billingCycle === "monthly" ? selectedPlan.priceMonthlyCents : selectedPlan.priceYearlyCents;
    activateProjectSubscription(project.id, {
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      billingCycle,
      amountCents,
      currency: selectedPlan.currency || "USD",
    });
    setBusy(false);
    navigate(`/projects/${project.id}`);
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Home", to: "/dashboard" },
          { label: "My Projects", to: "/projects" },
          { label: "Subscription" },
        ]}
      />

      <header className="rounded-2xl border border-zinc-300 bg-white/85 p-5 shadow-glass sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Project Checkout</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Choose plan for {project.name}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          A project is active only when it has a valid paid subscription. Without payment, status remains not started / on hold.
        </p>
      </header>

      {!ready ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
          Required onboarding assets are incomplete for this project. Complete setup in{" "}
          <Link to="/projects" className="font-semibold underline">
            My Projects
          </Link>{" "}
          before checkout.
        </section>
      ) : plans.length === 0 ? (
        <section className="rounded-2xl border border-zinc-300 bg-white/85 p-5 text-sm text-zinc-700 shadow-glass">
          Plans are not available right now. Please retry after portal data loads.
        </section>
      ) : (
        <>
          <div className="inline-flex rounded-full border border-zinc-300 bg-white/80 p-1">
            {(["monthly", "yearly"] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  billingCycle === cycle ? "bg-zinc-900 text-white" : "text-zinc-700 hover:text-zinc-900"
                }`}
              >
                {cycle === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => {
              const active = selectedPlanId === plan.id;
              const amount = billingCycle === "monthly" ? plan.priceMonthlyCents : plan.priceYearlyCents;
              return (
                <article
                  key={plan.id}
                  className={`rounded-2xl border p-5 shadow-glass transition ${
                    active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white/90 text-zinc-900"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">{plan.code}</p>
                  <h2 className="mt-1 text-xl font-bold">{plan.name}</h2>
                  <p className={`mt-2 text-2xl font-black ${active ? "text-white" : "text-zinc-900"}`}>{money(amount, plan.currency)}</p>
                  <button
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`mt-4 w-full rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-white text-zinc-900 hover:bg-zinc-100"
                        : "border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500"
                    }`}
                  >
                    {active ? "Selected" : "Select plan"}
                  </button>
                </article>
              );
            })}
          </section>

          <section className="rounded-2xl border border-zinc-300 bg-white/90 p-5 shadow-glass sm:p-6">
            <h3 className="text-sm font-semibold text-zinc-900">Secure checkout</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Continue to activate this project subscription. Payment is processed securely.
            </p>
            <button
              type="button"
              disabled={!selectedPlan || busy}
              onClick={() => void onSecureCheckout()}
              className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? "Processing..." : "Complete secure checkout"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}

