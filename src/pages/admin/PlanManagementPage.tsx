import { FormEvent, useEffect, useState } from "react";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { isModuleForbiddenError } from "@/services/http";
import { createAdminPlan, deleteAdminPlan, fetchAdminPlans, updateAdminPlan } from "@/services/subscriptionsApi";
import type { Plan } from "@/types/subscription";

export function PlanManagementPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [monthly, setMonthly] = useState("29");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eMonthly, setEMonthly] = useState("");
  const [eYearly, setEYearly] = useState("");
  const [eFeatures, setEFeatures] = useState("");
  const [eTrial, setETrial] = useState("14");
  const [eActive, setEActive] = useState(true);
  const [noModuleAccess, setNoModuleAccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null });

  async function load() {
    setNoModuleAccess(false);
    const next = await fetchAdminPlans();
    setPlans(next);
    updateCache({ plans: next });
  }

  useEffect(() => {
    if (cache.plans) setPlans(cache.plans);
    void load().catch((err) => {
      if (isModuleForbiddenError(err)) {
        setNoModuleAccess(true);
        return;
      }
      setNotice("Could not load plans.");
    });
  }, []);

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Plans" />;
  }

  function startEdit(plan: Plan) {
    setEditingId(plan.id);
    setEName(plan.name);
    setEDesc(plan.description);
    setEMonthly(String(plan.priceMonthlyCents / 100));
    setEYearly(String(plan.priceYearlyCents / 100));
    setEFeatures(plan.features.join("\n"));
    setETrial(String(plan.trialDays));
    setEActive(plan.isActive);
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
      await updateAdminPlan(editingId, {
        name: eName.trim(),
        description: eDesc,
        priceMonthlyCents: Math.round(Number(eMonthly) * 100),
        priceYearlyCents: Math.round(Number(eYearly) * 100),
        features,
        trialDays: Math.max(0, parseInt(eTrial, 10) || 0),
        isActive: eActive,
      });
      setEditingId(null);
      await load();
    } catch {
      setNotice("Could not save plan changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlan() {
    if (!deleteConfirm.plan) return;
    setDeletingPlanId(deleteConfirm.plan.id);
    try {
      await deleteAdminPlan(deleteConfirm.plan.id);
      setDeleteConfirm({ open: false, plan: null });
      await load();
    } catch {
      setNotice("Could not delete plan.");
    } finally {
      setDeletingPlanId(null);
    }
  }

  async function addPlan() {
    if (!name.trim()) return;
    setCreating(true);
    setNotice(null);
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
      });
      setName("");
      setDescription("");
      setMonthly("29");
      await load();
    } catch {
      setNotice("Plan creation failed. Check Stripe configuration and plan fields.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-white">Plan Inventory</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Create plans in Stripe and the app catalog together, and edit pricing/catalog details from one place.
        </p>
      </header>
      {notice && <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/90">{notice}</p>}

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
          <article key={plan.id} className="rounded-xl border border-[#24292E] bg-[#15191C] p-5">
            {editingId === plan.id ? (
              <form className="space-y-3" onSubmit={saveEdit}>
                <input
                  value={eName}
                  onChange={(e) => setEName(e.target.value)}
                  className="w-full rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                />
                <textarea
                  value={eDesc}
                  onChange={(e) => setEDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={eMonthly}
                    onChange={(e) => setEMonthly(e.target.value)}
                    placeholder="Monthly $"
                    className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                  />
                  <input
                    value={eYearly}
                    onChange={(e) => setEYearly(e.target.value)}
                    placeholder="Yearly $"
                    className="rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                  />
                </div>
                <textarea
                  value={eFeatures}
                  onChange={(e) => setEFeatures(e.target.value)}
                  placeholder="One feature per line"
                  rows={4}
                  className="w-full rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-xs text-white outline-none focus:border-brand-lime/35"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-ink-muted">
                    <input type="checkbox" checked={eActive} onChange={(e) => setEActive(e.target.checked)} className="accent-brand-lime" />
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
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 rounded-full bg-brand-lime px-4 py-2 text-xs font-semibold text-canvas disabled:opacity-50"
                  >
                    {saving && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setEditingId(null)}
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
                    <h3 className="text-base font-semibold text-white">{plan.name}</h3>
                    <p className="text-sm text-ink-muted">
                      ${(plan.priceMonthlyCents / 100).toFixed(2)} mo · ${(plan.priceYearlyCents / 100).toFixed(2)} yr
                    </p>
                    <p className="mt-1 text-xs text-ink-subtle">{plan.isActive ? "Active" : "Inactive"}</p>
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
                <p className="mt-2 text-sm text-ink-muted">{plan.description}</p>
              </>
            )}
          </article>
        ))}
      </section>

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete plan"
        description={
          <>
            Are you sure you want to delete <span className="font-semibold text-white">{deleteConfirm.plan?.name}</span>?
            This will remove the plan from the catalog. Existing subscriptions may be affected.
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
