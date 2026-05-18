import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { useToast } from "@/components/Toast";
import {
  CatalogObjectEditor,
  catalogToRows,
  rowsToCatalog,
  type CatalogEditRow,
} from "@/components/admin/CatalogObjectEditor";
import { AddonPlanPricingEditor } from "@/components/admin/AddonPlanPricingEditor";
import {
  AdminAddonFieldLabel,
  AdminAddonLabeledInput,
  AdminAddonLabeledSelect,
} from "@/components/admin/AdminAddonField";
import {
  EXTRA_EDIT_BUNDLE_CODE,
  EXTRA_EDIT_SINGLE_CODE,
  LEGACY_EXTRA_EDIT_PACK_CODE,
} from "@/constants/extraEditAddons";
import {
  addonUsesPlanWisePricing,
  firstPlanPriceCents,
  readExtraEditTier,
  seedPlanPricingFromAddon,
  type AddonPlanPricing,
} from "@/lib/addonPlanPricing";
import {
  PlanWebsiteCatalogEditor,
  planWebsiteCatalogValuesFromPlan,
  planWebsiteCatalogValuesToPayload,
  type PlanWebsiteCatalogValues,
} from "@/components/admin/PlanWebsiteCatalogEditor";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import { isModuleForbiddenError, userFacingApiError } from "@/services/http";
import {
  createAdminAddon,
  createAdminPlan,
  deleteAdminPlan,
  fetchAdminAddons,
  fetchAdminPlans,
  updateAdminAddon,
  updateAdminPlan,
} from "@/services/subscriptionsApi";
import type { Plan, SubscriptionAddon } from "@/types/subscription";
import { FormEvent, useEffect, useState } from "react";

function moneyInputToNullableCents(s: string): number | null {
  const t = s.trim().replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

export function PlanManagementPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const { showSuccess, showError } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [addons, setAddons] = useState<SubscriptionAddon[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [monthly, setMonthly] = useState("29");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eMonthly, setEMonthly] = useState("");
  const [eYearly, setEYearly] = useState("");
  const [eFeatures, setEFeatures] = useState("");
  const [eTrial, setETrial] = useState("14");
  const [eActive, setEActive] = useState(true);
  const [eBillMonthly, setEBillMonthly] = useState(true);
  const [eBillYearly, setEBillYearly] = useState(true);
  const [eIncludedCredits, setEIncludedCredits] = useState("0");
  const [ePlanCode, setEPlanCode] = useState("");
  const [eCurrency, setECurrency] = useState("USD");
  const [ePlanWebsiteCatalog, setEPlanWebsiteCatalog] =
    useState<PlanWebsiteCatalogValues | null>(null);
  const [eStripeProduct, setEStripeProduct] = useState("");
  const [eStripePriceMonthly, setEStripePriceMonthly] = useState("");
  const [eStripePriceYearly, setEStripePriceYearly] = useState("");
  const [eRazorpayPlan, setERazorpayPlan] = useState("");
  const [createBillMonthly, setCreateBillMonthly] = useState(true);
  const [createBillYearly, setCreateBillYearly] = useState(true);
  const [noModuleAccess, setNoModuleAccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    plan: Plan | null;
  }>({ open: false, plan: null });
  const [addonLabel, setAddonLabel] = useState("");
  const [addonCode, setAddonCode] = useState("");
  const [addonPrice, setAddonPrice] = useState("19");
  const [addonDesc, setAddonDesc] = useState("");
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null);
  const [eAddonDesc, setEAddonDesc] = useState("");
  const [eAddonPrice, setEAddonPrice] = useState("");
  const [eAddonBillMonthly, setEAddonBillMonthly] = useState(true);
  const [eAddonBillYearly, setEAddonBillYearly] = useState(true);
  const [eAddonBillingKind, setEAddonBillingKind] = useState<
    "recurring" | "one_time" | "per_use"
  >("recurring");
  const [eAddonCatalogRows, setEAddonCatalogRows] = useState<CatalogEditRow[]>(
    [],
  );
  const [eAddonPlanPricing, setEAddonPlanPricing] = useState<AddonPlanPricing>({});
  const [eAddonSetupFee, setEAddonSetupFee] = useState("0");
  const [eAddonPriceMin, setEAddonPriceMin] = useState("");
  const [eAddonPriceMax, setEAddonPriceMax] = useState("");
  const [eAddonDelivery, setEAddonDelivery] = useState("");
  const [eAddonEligible, setEAddonEligible] = useState("");
  const [addonCreateBillMonthly, setAddonCreateBillMonthly] = useState(true);
  const [addonCreateBillYearly, setAddonCreateBillYearly] = useState(true);
  const [addonCreateBillingKind, setAddonCreateBillingKind] = useState<
    "recurring" | "one_time" | "per_use"
  >("recurring");
  const [addonCreateCurrency, setAddonCreateCurrency] = useState("USD");
  const [addonCreateSetupFee, setAddonCreateSetupFee] = useState("0");
  const [addonCreatePriceMin, setAddonCreatePriceMin] = useState("");
  const [addonCreatePriceMax, setAddonCreatePriceMax] = useState("");
  const [addonCreateDelivery, setAddonCreateDelivery] = useState("");
  const [addonCreateEligible, setAddonCreateEligible] = useState("");

  async function load() {
    setNoModuleAccess(false);
    const [next, addonRows] = await Promise.all([fetchAdminPlans(), fetchAdminAddons()]);
    const visibleAddons = addonRows.filter((a) => a.code !== LEGACY_EXTRA_EDIT_PACK_CODE);
    setPlans(next);
    setAddons(visibleAddons);
    updateCache({ plans: next });
  }

  useEffect(() => {
    if (cache.plans) setPlans(cache.plans);
    void load().catch((err) => {
      if (isModuleForbiddenError(err)) {
        setNoModuleAccess(true);
        return;
      }
      showError("Could not load plans or add-ons. Please try again.");
    });
  }, []);

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Plans" />;
  }

  function startEdit(plan: Plan) {
    setEditingId(plan.id);
    setEPlanCode(plan.code);
    setECurrency((plan.currency || "USD").toUpperCase());
    setEName(plan.name);
    setEDesc(plan.description);
    setEMonthly(String(plan.priceMonthlyCents / 100));
    setEYearly(String(plan.priceYearlyCents / 100));
    setEFeatures(plan.features.join("\n"));
    setETrial(String(plan.trialDays));
    setEActive(plan.isActive);
    setEBillMonthly(plan.billingMonthlyEnabled !== false);
    setEBillYearly(plan.billingYearlyEnabled !== false);
    setEIncludedCredits(String(plan.includedEditCreditsPerPeriod ?? 0));
    setEPlanWebsiteCatalog(planWebsiteCatalogValuesFromPlan(plan));
    setEStripeProduct(plan.stripeProductId?.trim() ?? "");
    setEStripePriceMonthly(plan.stripePriceMonthlyId?.trim() ?? "");
    setEStripePriceYearly(plan.stripePriceYearlyId?.trim() ?? "");
    setERazorpayPlan(plan.razorpayPlanId?.trim() ?? "");
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    try {
      const features = eFeatures
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!ePlanWebsiteCatalog) {
        showError("Plan catalog is not loaded.");
        setSaving(false);
        return;
      }
      const catalogJson =
        planWebsiteCatalogValuesToPayload(ePlanWebsiteCatalog);
      await updateAdminPlan(editingId, {
        description: eDesc,
        priceMonthlyCents: Math.round(Number(eMonthly) * 100),
        priceYearlyCents: Math.round(Number(eYearly) * 100),
        features,
        trialDays: Math.max(0, parseInt(eTrial, 10) || 0),
        isActive: eActive,
        billingMonthlyEnabled: eBillMonthly,
        billingYearlyEnabled: eBillYearly,
        includedEditCreditsPerPeriod: Math.max(
          0,
          parseInt(eIncludedCredits, 10) || 0,
        ),
        catalogJson,
        stripeProductId: emptyToNull(eStripeProduct),
        stripePriceMonthlyId: emptyToNull(eStripePriceMonthly),
        stripePriceYearlyId: emptyToNull(eStripePriceYearly),
        razorpayPlanId: emptyToNull(eRazorpayPlan),
      });
      showSuccess("Plan updated successfully.");
      setEditingId(null);
      setEPlanWebsiteCatalog(null);
      await load();
    } catch (err) {
      showError(
        userFacingApiError(
          err,
          "Could not save plan changes. Please try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlan() {
    if (!deleteConfirm.plan) return;
    setDeletingPlanId(deleteConfirm.plan.id);
    try {
      await deleteAdminPlan(deleteConfirm.plan.id);
      showSuccess("Plan deleted successfully.");
      setDeleteConfirm({ open: false, plan: null });
      await load();
    } catch {
      showError("Could not delete plan. Please try again.");
    } finally {
      setDeletingPlanId(null);
    }
  }

  async function addPlan() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createAdminPlan({
        code: name.toLowerCase().replace(/\s+/g, "-"),
        name: name.trim(),
        description: description.trim() || "Custom admin-defined plan",
        priceMonthlyCents: Math.round(Number(monthly) * 100),
        priceYearlyCents: Math.round(Number(monthly) * 100 * 10),
        currency: "USD",
        features: ["Admin-created feature set"],
        isActive: true,
        trialDays: 14,
        billingMonthlyEnabled: createBillMonthly,
        billingYearlyEnabled: createBillYearly,
      });
      showSuccess("Plan created successfully.");
      setName("");
      setDescription("");
      setMonthly("29");
      await load();
    } catch {
      showError(
        "Plan creation failed. Check Stripe configuration and plan fields.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function addAddon() {
    if (!addonCode.trim() || !addonLabel.trim()) return;
    try {
      await createAdminAddon({
        code: addonCode.trim().toLowerCase(),
        label: addonLabel.trim(),
        desc: addonDesc.trim(),
        priceCents: Math.round(Number(addonPrice) * 100),
        currency: addonCreateCurrency.trim().toUpperCase() || "USD",
        isActive: true,
        billingMonthlyEnabled: addonCreateBillMonthly,
        billingYearlyEnabled: addonCreateBillYearly,
        billingKind: addonCreateBillingKind,
        setupFeeCents: Math.round(
          Math.max(0, Number(addonCreateSetupFee) || 0) * 100,
        ),
        priceMinCents: moneyInputToNullableCents(addonCreatePriceMin),
        priceMaxCents: moneyInputToNullableCents(addonCreatePriceMax),
        deliveryMode: addonCreateDelivery.trim(),
        eligiblePlanCodes: addonCreateEligible
          .split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
        catalogJson: {},
      });
      showSuccess("Add-on created successfully.");
      setAddonCode("");
      setAddonLabel("");
      setAddonDesc("");
      setAddonPrice("19");
      setAddonCreateCurrency("USD");
      setAddonCreateSetupFee("0");
      setAddonCreatePriceMin("");
      setAddonCreatePriceMax("");
      setAddonCreateDelivery("");
      setAddonCreateEligible("");
      await load();
    } catch {
      showError("Could not create add-on.");
    }
  }

  async function toggleAddon(addon: SubscriptionAddon, nextActive: boolean) {
    try {
      await updateAdminAddon(String(addon.id), { isActive: nextActive });
      await load();
    } catch {
      showError("Could not update add-on.");
    }
  }

  function extraEditTierForAddon(addon: SubscriptionAddon): "single" | "bundle" | null {
    const tier = readExtraEditTier(addon.catalogJson);
    if (tier) return tier;
    if (addon.code === EXTRA_EDIT_SINGLE_CODE) return "single";
    if (addon.code === EXTRA_EDIT_BUNDLE_CODE) return "bundle";
    return null;
  }

  function catalogRowsWithoutPricingKeys(catalog: Record<string, unknown>): CatalogEditRow[] {
    const skip = new Set([
      "planPricing",
      "plan_pricing",
      "effectKind",
      "effect_kind",
      "extraEditTier",
      "extra_edit_tier",
    ]);
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(catalog)) {
      if (!skip.has(k)) filtered[k] = v;
    }
    return catalogToRows(filtered);
  }

  function startAddonEdit(addon: SubscriptionAddon) {
    setEditingAddonId(String(addon.id));
    setEAddonDesc(addon.desc);
    setEAddonPlanPricing(seedPlanPricingFromAddon(addon, plans));
    setEAddonPrice((addon.priceCents / 100).toFixed(2));
    setEAddonBillMonthly(addon.billingMonthlyEnabled !== false);
    setEAddonBillYearly(addon.billingYearlyEnabled !== false);
    setEAddonBillingKind(addon.billingKind ?? "recurring");
    setEAddonSetupFee(((addon.setupFeeCents ?? 0) / 100).toFixed(2));
    setEAddonPriceMin(
      addon.priceMinCents != null ? String(addon.priceMinCents / 100) : "",
    );
    setEAddonPriceMax(
      addon.priceMaxCents != null ? String(addon.priceMaxCents / 100) : "",
    );
    setEAddonDelivery(addon.deliveryMode ?? "");
    setEAddonEligible((addon.eligiblePlanCodes ?? []).join(", "));
    setEAddonCatalogRows(
      addonUsesPlanWisePricing(addon)
        ? catalogRowsWithoutPricingKeys((addon.catalogJson ?? {}) as Record<string, unknown>)
        : catalogToRows(addon.catalogJson),
    );
  }

  async function saveAddonEdit(addonId: string, addon: SubscriptionAddon) {
    try {
      let catalogJson: Record<string, unknown> = {};
      try {
        catalogJson = rowsToCatalog(eAddonCatalogRows);
      } catch (err) {
        showError(
          err instanceof Error ? err.message : "Invalid add-on catalog data.",
        );
        return;
      }
      const extraTier = extraEditTierForAddon(addon);
      const usesPlanPricing = addonUsesPlanWisePricing(addon);
      if (usesPlanPricing || extraTier) {
        catalogJson = {
          ...catalogJson,
          planPricing: eAddonPlanPricing,
          ...(extraTier
            ? { effectKind: "credit_pack", extraEditTier: extraTier }
            : {}),
        };
      }
      const eligible = eAddonEligible
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const setupCents = Math.round(
        Math.max(0, Number(eAddonSetupFee) || 0) * 100,
      );
      const pricingFallback = firstPlanPriceCents(eAddonPlanPricing);
      const priceCents =
        usesPlanPricing && pricingFallback != null && pricingFallback > 0
          ? pricingFallback
          : Math.round(Number(eAddonPrice) * 100);
      await updateAdminAddon(addonId, {
        desc: eAddonDesc.trim(),
        priceCents,
        billingMonthlyEnabled: eAddonBillMonthly,
        billingYearlyEnabled: eAddonBillYearly,
        billingKind: eAddonBillingKind,
        setupFeeCents: setupCents,
        priceMinCents: usesPlanPricing ? null : moneyInputToNullableCents(eAddonPriceMin),
        priceMaxCents: usesPlanPricing ? null : moneyInputToNullableCents(eAddonPriceMax),
        deliveryMode: eAddonDelivery.trim(),
        eligiblePlanCodes: eligible,
        catalogJson,
      });
      setEditingAddonId(null);
      setEAddonPlanPricing({});
      showSuccess("Add-on updated successfully.");
      await load();
    } catch {
      showError("Could not update add-on.");
    }
  }

  const editingAddon = addons.find((a) => String(a.id) === editingAddonId);
  const editingExtraEditTier = editingAddon
    ? extraEditTierForAddon(editingAddon)
    : null;
  const editingUsesPlanPricing = editingAddon
    ? addonUsesPlanWisePricing(editingAddon)
    : false;
  const activePlans = plans.filter((p) => p.isActive !== false);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-white">
          Plan Inventory
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Create plans in Stripe and the app catalog together, and edit
          pricing/catalog details from one place.
        </p>
      </header>
      <section className="rounded-xl border border-[#24292E] bg-[#15191C] p-6">
        <h2 className="text-sm font-semibold text-white">Create plan</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Plan name"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Plan description"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35 md:col-span-2"
          />
          <input
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            placeholder="Monthly price (USD)"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 md:col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={createBillMonthly}
                onChange={(e) => setCreateBillMonthly(e.target.checked)}
                className="accent-brand-lime"
              />
              Monthly billing
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={createBillYearly}
                onChange={(e) => setCreateBillYearly(e.target.checked)}
                className="accent-brand-lime"
              />
              Yearly billing
            </label>
            <span className="text-zinc-500">
              Uncheck both for a one-time plan (uses monthly price as purchase
              amount).
            </span>
          </div>
          <button
            type="button"
            disabled={creating}
            onClick={() => void addPlan()}
            className="rounded-lg bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas transition hover:bg-brand-lime-dim disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className="rounded-xl border border-[#24292E] bg-[#15191C] p-5"
          >
            {editingId === plan.id ? (
              <form className="space-y-3" onSubmit={saveEdit}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                      Plan code
                    </label>
                    <input
                      value={ePlanCode}
                      readOnly
                      title="Code cannot be changed after the plan is created."
                      spellCheck={false}
                      className="mt-1 w-full cursor-not-allowed rounded-lg border border-[#24292E] bg-[#1a1d22] px-3 py-2 font-mono text-sm text-zinc-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                      Currency
                    </label>
                    <input
                      value={eCurrency}
                      readOnly
                      title="Currency cannot be changed here."
                      maxLength={3}
                      className="mt-1 w-full cursor-not-allowed rounded-lg border border-[#24292E] bg-[#1a1d22] px-3 py-2 font-mono text-sm text-zinc-400 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                    Plan name
                  </label>
                  <input
                    value={eName}
                    readOnly
                    title="Name cannot be changed after the plan is created."
                    className="mt-1 w-full cursor-not-allowed rounded-lg border border-[#24292E] bg-[#1a1d22] px-3 py-2 text-sm text-zinc-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                    Description
                  </label>
                  <textarea
                    value={eDesc}
                    onChange={(e) => setEDesc(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                      Monthly price
                    </label>
                    <input
                      value={eMonthly}
                      onChange={(e) => setEMonthly(e.target.value)}
                      placeholder="Monthly $"
                      className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                      Yearly price
                    </label>
                    <input
                      value={eYearly}
                      onChange={(e) => setEYearly(e.target.value)}
                      placeholder="Yearly $"
                      className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                    Features
                  </label>
                  <textarea
                    value={eFeatures}
                    onChange={(e) => setEFeatures(e.target.value)}
                    placeholder="One feature per line"
                    rows={4}
                    className="w-full rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-xs text-white outline-none focus:border-brand-lime/35"
                  />
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-ink-muted">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={eBillMonthly}
                      onChange={(e) => setEBillMonthly(e.target.checked)}
                      className="accent-brand-lime"
                    />
                    Monthly available
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={eBillYearly}
                      onChange={(e) => setEBillYearly(e.target.checked)}
                      className="accent-brand-lime"
                    />
                    Yearly available
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={eActive}
                      onChange={(e) => setEActive(e.target.checked)}
                      className="accent-brand-lime"
                    />
                    Active in catalog
                  </label>
                  <input
                    value={eTrial}
                    onChange={(e) => setETrial(e.target.value)}
                    type="number"
                    min={0}
                    className="w-20 rounded border border-[#24292E] bg-[#1C2126] px-2 py-1 text-xs text-white"
                  />
                  <span className="text-xs text-ink-muted">trial days</span>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                    Included website edit credits / billing period
                  </label>
                  <input
                    value={eIncludedCredits}
                    onChange={(e) => setEIncludedCredits(e.target.value)}
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                  />
                </div>
                <div className="space-y-2 rounded-lg border border-[#24292E] bg-[#101317] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                    Stripe & Razorpay IDs (optional)
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={eStripeProduct}
                      onChange={(e) => setEStripeProduct(e.target.value)}
                      placeholder="Stripe product id"
                      spellCheck={false}
                      className="rounded border border-[#24292E] bg-[#1C2126] px-2 py-1.5 font-mono text-[11px] text-white"
                    />
                    <input
                      value={eRazorpayPlan}
                      onChange={(e) => setERazorpayPlan(e.target.value)}
                      placeholder="Razorpay plan id"
                      spellCheck={false}
                      className="rounded border border-[#24292E] bg-[#1C2126] px-2 py-1.5 font-mono text-[11px] text-white"
                    />
                    <input
                      value={eStripePriceMonthly}
                      onChange={(e) => setEStripePriceMonthly(e.target.value)}
                      placeholder="Stripe monthly price id"
                      spellCheck={false}
                      className="rounded border border-[#24292E] bg-[#1C2126] px-2 py-1.5 font-mono text-[11px] text-white"
                    />
                    <input
                      value={eStripePriceYearly}
                      onChange={(e) => setEStripePriceYearly(e.target.value)}
                      placeholder="Stripe yearly price id"
                      spellCheck={false}
                      className="rounded border border-[#24292E] bg-[#1C2126] px-2 py-1.5 font-mono text-[11px] text-white"
                    />
                  </div>
                </div>
                {ePlanWebsiteCatalog ? (
                  <PlanWebsiteCatalogEditor
                    value={ePlanWebsiteCatalog}
                    onChange={setEPlanWebsiteCatalog}
                  />
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 rounded-full bg-brand-lime px-4 py-2 text-xs font-semibold text-canvas disabled:opacity-50"
                  >
                    {saving && (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    )}
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setEditingId(null);
                      setEPlanWebsiteCatalog(null);
                    }}
                    className="rounded-full border border-white/15 px-4 py-2 text-xs text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      {plan.name}
                    </h3>
                    <p className="text-[11px] font-mono text-zinc-500">
                      {plan.code}
                    </p>
                    <p className="text-sm text-ink-muted">
                      ${(plan.priceMonthlyCents / 100).toFixed(2)} mo · $
                      {(plan.priceYearlyCents / 100).toFixed(2)} yr
                    </p>
                    <p className="mt-1 text-xs text-green-500">
                      {plan.includedEditCreditsPerPeriod ?? 0} website edit
                      credits / billing period
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">
                      {plan.billingMonthlyEnabled === false &&
                      plan.billingYearlyEnabled === false
                        ? "One-time plan (customer sees monthly field as purchase price)"
                        : [
                            plan.billingMonthlyEnabled !== false
                              ? "Monthly"
                              : null,
                            plan.billingYearlyEnabled !== false
                              ? "Yearly"
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No billing intervals"}
                    </p>
                    <p className="mt-1 text-xs text-ink-subtle">
                      {plan.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(plan)}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white transition hover:border-brand-lime/35"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={deletingPlanId === plan.id}
                      onClick={() => setDeleteConfirm({ open: true, plan })}
                      className="flex items-center gap-1 rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      {deletingPlanId === plan.id && (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      )}
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-ink-muted">
                  {plan.description}
                </p>
              </>
            )}
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-[#24292E] bg-[#15191C] p-6">
        <h2 className="text-sm font-semibold text-white">Manage add-ons</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <input
            value={addonCode}
            onChange={(e) => setAddonCode(e.target.value)}
            placeholder="Code"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <input
            value={addonLabel}
            onChange={(e) => setAddonLabel(e.target.value)}
            placeholder="Label"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <input
            value={addonPrice}
            onChange={(e) => setAddonPrice(e.target.value)}
            placeholder="Base price"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <input
            value={addonDesc}
            onChange={(e) => setAddonDesc(e.target.value)}
            placeholder="Description"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35 md:col-span-2"
          />
          <input
            value={addonCreateCurrency}
            onChange={(e) =>
              setAddonCreateCurrency(e.target.value.toUpperCase())
            }
            maxLength={3}
            placeholder="USD"
            title="Currency"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 font-mono text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <input
            value={addonCreateSetupFee}
            onChange={(e) => setAddonCreateSetupFee(e.target.value)}
            placeholder="Setup fee (USD)"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <input
            value={addonCreatePriceMin}
            onChange={(e) => setAddonCreatePriceMin(e.target.value)}
            placeholder="Min price (optional)"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <input
            value={addonCreatePriceMax}
            onChange={(e) => setAddonCreatePriceMax(e.target.value)}
            placeholder="Max price (optional)"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <input
            value={addonCreateDelivery}
            onChange={(e) => setAddonCreateDelivery(e.target.value)}
            placeholder="Delivery mode"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35 md:col-span-2"
          />
          <input
            value={addonCreateEligible}
            onChange={(e) => setAddonCreateEligible(e.target.value)}
            placeholder="Eligible plan codes (comma-separated)"
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35 md:col-span-3"
          />
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 md:col-span-5">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={addonCreateBillMonthly}
                onChange={(e) => setAddonCreateBillMonthly(e.target.checked)}
                className="accent-brand-lime"
              />
              With monthly plan
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={addonCreateBillYearly}
                onChange={(e) => setAddonCreateBillYearly(e.target.checked)}
                className="accent-brand-lime"
              />
              With yearly plan
            </label>
            <label className="flex items-center gap-2 text-zinc-300">
              <span>Billing kind</span>
              <select
                value={addonCreateBillingKind}
                onChange={(e) =>
                  setAddonCreateBillingKind(
                    e.target.value as "recurring" | "one_time" | "per_use",
                  )
                }
                className="rounded border border-[#24292E] bg-[#1C2126] px-2 py-1 text-xs text-white"
              >
                <option value="recurring">Recurring</option>
                <option value="one_time">One time</option>
                <option value="per_use">Per use</option>
              </select>
            </label>
            <span className="text-zinc-500">
              Uncheck both for one-time-style add-ons (allowed on one-time plans
              only).
            </span>
          </div>
          <button
            type="button"
            onClick={() => void addAddon()}
            className="rounded-lg bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas transition hover:bg-brand-lime-dim"
          >
            Add Add-on
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {addons.map((addon) => (
            <div
              key={addon.id ?? addon.code}
              className="flex items-center justify-between rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm"
            >
              {editingAddonId === String(addon.id) ? (
                <div className="flex w-full flex-col gap-2">
                  <div className="rounded border border-[#2A3037]/80 bg-[#15191C] px-2 py-1.5 text-[11px] text-zinc-300">
                    <span className="font-semibold text-white">
                      {addon.label}
                    </span>{" "}
                    <span className="font-mono text-zinc-500">
                      ({addon.code})
                    </span>
                    <span className="text-zinc-500"> · </span>
                    <span className="font-mono text-zinc-400">
                      {(addon.currency || "USD").toUpperCase()}
                    </span>
                    <span className="block text-[10px] text-zinc-500">
                      Name, code, and currency cannot be changed here.
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <AdminAddonLabeledInput
                      label="Description"
                      value={eAddonDesc}
                      onChange={(e) => setEAddonDesc(e.target.value)}
                      className="md:col-span-2 lg:col-span-3"
                    />
                    {!editingUsesPlanPricing ? (
                      <AdminAddonLabeledInput
                        label="Default price (USD)"
                        type="number"
                        min={0}
                        step="0.01"
                        value={eAddonPrice}
                        onChange={(e) => setEAddonPrice(e.target.value)}
                        hint="Used when plan-wise pricing is not configured."
                      />
                    ) : null}
                    <AdminAddonLabeledInput
                      label="Setup fee (USD)"
                      type="number"
                      min={0}
                      step="0.01"
                      value={eAddonSetupFee}
                      onChange={(e) => setEAddonSetupFee(e.target.value)}
                    />
                    <AdminAddonLabeledInput
                      label="Delivery mode"
                      value={eAddonDelivery}
                      onChange={(e) => setEAddonDelivery(e.target.value)}
                      placeholder="manual, semi_auto, automated"
                    />
                    <AdminAddonLabeledSelect
                      label="Billing kind"
                      value={eAddonBillingKind}
                      onChange={(e) =>
                        setEAddonBillingKind(
                          e.target.value as "recurring" | "one_time" | "per_use",
                        )
                      }
                    >
                      <option value="recurring">Recurring</option>
                      <option value="one_time">One time</option>
                      <option value="per_use">Per use</option>
                    </AdminAddonLabeledSelect>
                    <AdminAddonLabeledInput
                      label="Eligible plan codes"
                      value={eAddonEligible}
                      onChange={(e) => setEAddonEligible(e.target.value)}
                      hint="Comma-separated. Plan pricing rows below use these plans when set."
                      className="md:col-span-2 lg:col-span-3"
                    />
                  </div>
                  <div className="rounded border border-[#2A3037]/60 bg-[#15191C]/80 px-3 py-2">
                    <AdminAddonFieldLabel>Available with billing cycle</AdminAddonFieldLabel>
                    <div className="mt-2 flex flex-wrap gap-6 text-xs text-zinc-300">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={eAddonBillMonthly}
                          onChange={(e) => setEAddonBillMonthly(e.target.checked)}
                          className="accent-brand-lime"
                        />
                        Monthly subscriptions
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={eAddonBillYearly}
                          onChange={(e) => setEAddonBillYearly(e.target.checked)}
                          className="accent-brand-lime"
                        />
                        Yearly subscriptions
                      </label>
                    </div>
                    <p className="mt-1.5 text-[10px] text-zinc-500">
                      Uncheck both for one-time-style add-ons (purchase allowed on one-time
                      plans only).
                    </p>
                  </div>
                  {editingUsesPlanPricing && editingAddon ? (
                    <AddonPlanPricingEditor
                      addon={editingAddon}
                      plans={activePlans}
                      pricing={eAddonPlanPricing}
                      onChange={setEAddonPlanPricing}
                      showCredits={editingExtraEditTier === "bundle"}
                    />
                  ) : null}
                  <CatalogObjectEditor
                    rows={eAddonCatalogRows}
                    onChange={setEAddonCatalogRows}
                    title={
                      editingUsesPlanPricing
                        ? "Other add-on catalog fields"
                        : "Add-on catalog fields"
                    }
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveAddonEdit(String(addon.id), addon)}
                      className="rounded-md bg-brand-lime px-3 py-1 text-xs font-semibold text-canvas"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAddonId(null)}
                      className="rounded-md border border-white/15 px-3 py-1 text-xs text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="font-semibold text-white">
                      {addon.label}{" "}
                      <span className="text-xs text-zinc-500">
                        ({addon.code})
                      </span>
                    </p>
                    <p className="text-xs text-zinc-400">
                      {(addon.currency || "USD").toUpperCase()}{" "}
                      {addonUsesPlanWisePricing(addon)
                        ? "per-plan pricing (see edit)"
                        : `$${(addon.priceCents / 100).toFixed(2)}`}
                      {(addon.setupFeeCents ?? 0) > 0
                        ? ` + $${((addon.setupFeeCents ?? 0) / 100).toFixed(2)} setup`
                        : ""}
                      {" · "}
                      {addon.billingKind ?? "recurring"}
                      {addon.eligiblePlanCodes &&
                      addon.eligiblePlanCodes.length > 0
                        ? ` · plans: ${addon.eligiblePlanCodes.join(", ")}`
                        : ""}
                      {addon.deliveryMode ? ` · ${addon.deliveryMode}` : ""}
                      {" · "}
                      {addon.desc}
                      <span className="ml-1 text-zinc-500">
                        (
                        {addon.billingMonthlyEnabled === false &&
                        addon.billingYearlyEnabled === false
                          ? "one-time style"
                          : [
                              addon.billingMonthlyEnabled !== false
                                ? "monthly"
                                : null,
                              addon.billingYearlyEnabled !== false
                                ? "yearly"
                                : null,
                            ]
                              .filter(Boolean)
                              .join(", ") || "—"}
                        )
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startAddonEdit(addon)}
                      className="rounded-md border border-white/15 px-3 py-1 text-xs text-white"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleAddon(addon, !addon.isActive)}
                      className="rounded-md border border-white/15 px-3 py-1 text-xs text-white"
                    >
                      {addon.isActive ? "Disable" : "Enable"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete plan"
        description={
          <>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-white">
              {deleteConfirm.plan?.name}
            </span>
            ? This will remove the plan from the catalog. Existing subscriptions
            may be affected.
          </>
        }
        confirmLabel="Delete plan"
        variant="danger"
        loading={deletingPlanId !== null}
        onConfirm={() => void handleDeletePlan()}
        onCancel={() => setDeleteConfirm({ open: false, plan: null })}
      />
    </div>
  );
}
