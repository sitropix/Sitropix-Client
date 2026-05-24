import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
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
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxConfirmDialog } from "@/components/sx/ConfirmDialog";
import { SxInput, SxSelect, SxTextarea } from "@/components/sx/Input";
import { SxPanel } from "@/components/sx/Panel";
import { SxSegmentedControl } from "@/components/sx/SegmentedControl";
import { useSxToast } from "@/components/sx/Toast";

type Tab = "plans" | "addons";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

const EMPTY_PLAN: Partial<Plan> = {
  code: "",
  name: "",
  description: "",
  priceMonthlyCents: 0,
  priceYearlyCents: 0,
  currency: "USD",
  features: [],
  isActive: true,
  trialDays: 0,
  billingMonthlyEnabled: true,
  billingYearlyEnabled: true,
  includedEditCreditsPerPeriod: 0,
};

const EMPTY_ADDON: Partial<SubscriptionAddon> & {
  code: string;
  label: string;
  priceCents: number;
} = {
  code: "",
  label: "",
  desc: "",
  priceCents: 0,
  currency: "USD",
  isActive: true,
  billingKind: "one_time",
  billingMonthlyEnabled: false,
  billingYearlyEnabled: false,
  setupFeeCents: 0,
};

export function PlanManagementPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const toast = useSxToast();
  const [tab, setTab] = useState<Tab>("plans");

  // ---- plans ----
  const [plans, setPlans] = useState<Plan[]>(cache.plans ?? []);
  const [plansLoading, setPlansLoading] = useState(!cache.plans);
  const [editingPlanId, setEditingPlanId] = useState<string | "new" | null>(
    null,
  );
  const [planForm, setPlanForm] = useState<Partial<Plan>>(EMPTY_PLAN);
  const [planFeaturesText, setPlanFeaturesText] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [deletingPlan, setDeletingPlan] = useState(false);

  // ---- addons ----
  const [addons, setAddons] = useState<SubscriptionAddon[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(true);
  const [editingAddonId, setEditingAddonId] = useState<string | "new" | null>(
    null,
  );
  const [addonForm, setAddonForm] =
    useState<typeof EMPTY_ADDON>(EMPTY_ADDON);
  const [savingAddon, setSavingAddon] = useState(false);

  async function reloadPlans() {
    setPlansLoading(true);
    try {
      const rows = await fetchAdminPlans();
      setPlans(rows);
      updateCache({ plans: rows });
    } catch {
      toast.error("Couldn't load plans.");
    } finally {
      setPlansLoading(false);
    }
  }

  async function reloadAddons() {
    setAddonsLoading(true);
    try {
      const rows = await fetchAdminAddons();
      setAddons(rows);
    } catch {
      toast.error("Couldn't load add-ons.");
    } finally {
      setAddonsLoading(false);
    }
  }

  useEffect(() => {
    void reloadPlans();
    void reloadAddons();
  }, []);

  const sortedPlans = useMemo(
    () =>
      [...plans].sort(
        (a, b) =>
          (a.priceMonthlyCents ?? 0) - (b.priceMonthlyCents ?? 0) ||
          a.name.localeCompare(b.name),
      ),
    [plans],
  );

  function openPlanForEdit(plan: Plan | null) {
    if (plan) {
      setEditingPlanId(plan.id);
      setPlanForm({ ...plan });
      setPlanFeaturesText((plan.features ?? []).join("\n"));
    } else {
      setEditingPlanId("new");
      setPlanForm({ ...EMPTY_PLAN });
      setPlanFeaturesText("");
    }
  }

  function closePlanEditor() {
    setEditingPlanId(null);
    setPlanForm(EMPTY_PLAN);
    setPlanFeaturesText("");
  }

  function setPlanField<K extends keyof Plan>(key: K, value: Plan[K]) {
    setPlanForm((prev) => ({ ...prev, [key]: value }));
  }

  async function savePlan(e: FormEvent) {
    e.preventDefault();
    if (!planForm.code?.trim() || !planForm.name?.trim()) {
      toast.warning("Code and name are required.");
      return;
    }
    setSavingPlan(true);
    try {
      const features = planFeaturesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const payload: Partial<Plan> = { ...planForm, features };
      if (editingPlanId === "new") {
        await createAdminPlan(payload);
        toast.success("Plan created.");
      } else if (editingPlanId) {
        await updateAdminPlan(editingPlanId, payload);
        toast.success("Plan saved.");
      }
      await reloadPlans();
      closePlanEditor();
    } catch (err) {
      toast.error(
        "Couldn't save plan.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSavingPlan(false);
    }
  }

  async function confirmDeletePlan() {
    if (!deletePlanId) return;
    setDeletingPlan(true);
    try {
      await deleteAdminPlan(deletePlanId);
      toast.success("Plan archived.");
      setDeletePlanId(null);
      await reloadPlans();
    } catch (err) {
      toast.error(
        "Couldn't archive plan.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setDeletingPlan(false);
    }
  }

  // ---- addon form ----

  function openAddonForEdit(addon: SubscriptionAddon | null) {
    if (addon) {
      setEditingAddonId(addon.id ?? "new");
      setAddonForm({
        ...EMPTY_ADDON,
        ...addon,
      });
    } else {
      setEditingAddonId("new");
      setAddonForm({ ...EMPTY_ADDON });
    }
  }

  function closeAddonEditor() {
    setEditingAddonId(null);
    setAddonForm(EMPTY_ADDON);
  }

  async function saveAddon(e: FormEvent) {
    e.preventDefault();
    if (!addonForm.code?.trim() || !addonForm.label?.trim()) {
      toast.warning("Code and label are required.");
      return;
    }
    setSavingAddon(true);
    try {
      if (editingAddonId === "new") {
        await createAdminAddon({
          ...addonForm,
          code: addonForm.code.trim(),
          label: addonForm.label.trim(),
          priceCents: Number(addonForm.priceCents) || 0,
        });
        toast.success("Add-on created.");
      } else if (editingAddonId) {
        await updateAdminAddon(editingAddonId, {
          ...addonForm,
          priceCents: Number(addonForm.priceCents) || 0,
        });
        toast.success("Add-on saved.");
      }
      await reloadAddons();
      closeAddonEditor();
    } catch (err) {
      toast.error(
        "Couldn't save add-on.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSavingAddon(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-[var(--border-subtle)] pb-4">
        <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Catalog
        </p>
        <h1 className="mt-1.5 font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          Plans &amp; add-ons
        </h1>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">
          The subscription tiers and optional purchases customers see at checkout.
        </p>
      </header>

      <SxSegmentedControl<Tab>
        ariaLabel="Plans or add-ons"
        options={[
          { value: "plans", label: "Plans", count: plans.length },
          { value: "addons", label: "Add-ons", count: addons.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "plans" ? (
        <SxPanel
          title="Plans"
          action={
            <SxButton
              size="sm"
              onClick={() => openPlanForEdit(null)}
            >
              + New plan
            </SxButton>
          }
          padded={false}
        >
          {plansLoading ? (
            <p className="p-5 text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
          ) : sortedPlans.length === 0 ? (
            <p className="p-5 text-sx-sm text-[var(--text-tertiary)]">
              No plans yet. Click + New plan to create one.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {sortedPlans.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-ui text-sx-sm font-semibold text-[var(--text-primary)]">
                        {p.name}
                      </p>
                      <SxBadge
                        variant={p.isActive ? "success" : "closed"}
                        withDot={false}
                      >
                        {p.isActive ? "Active" : "Archived"}
                      </SxBadge>
                      {p.archivedAt ? (
                        <SxBadge variant="neutral">Archived</SxBadge>
                      ) : null}
                    </div>
                    <p className="mt-1 font-mono text-sx-xs text-[var(--text-tertiary)]">
                      {p.code} · {money(p.priceMonthlyCents, p.currency)}/mo ·{" "}
                      {money(p.priceYearlyCents, p.currency)}/yr ·{" "}
                      {p.includedEditCreditsPerPeriod ?? 0} edits/cycle ·{" "}
                      {p.trialDays || 0}-day trial
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <SxButton
                      variant="secondary"
                      size="sm"
                      onClick={() => openPlanForEdit(p)}
                    >
                      Edit
                    </SxButton>
                    <SxButton
                      variant="ghost"
                      size="sm"
                      className="!text-[var(--color-danger-fg)]"
                      onClick={() => setDeletePlanId(p.id)}
                    >
                      Archive
                    </SxButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SxPanel>
      ) : (
        <SxPanel
          title="Add-ons"
          action={
            <SxButton size="sm" onClick={() => openAddonForEdit(null)}>
              + New add-on
            </SxButton>
          }
          padded={false}
        >
          {addonsLoading ? (
            <p className="p-5 text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
          ) : addons.length === 0 ? (
            <p className="p-5 text-sx-sm text-[var(--text-tertiary)]">
              No add-ons yet.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {addons.map((a) => (
                <li
                  key={a.id ?? a.code}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-ui text-sx-sm font-semibold text-[var(--text-primary)]">
                        {a.label}
                      </p>
                      <SxBadge
                        variant={a.isActive !== false ? "success" : "closed"}
                        withDot={false}
                      >
                        {a.isActive !== false ? "Active" : "Inactive"}
                      </SxBadge>
                      <SxBadge variant="neutral" withDot={false}>
                        {a.billingKind ?? "one_time"}
                      </SxBadge>
                    </div>
                    <p className="mt-1 font-mono text-sx-xs text-[var(--text-tertiary)]">
                      {a.code} · {money(a.priceCents, a.currency ?? "USD")}
                      {a.setupFeeCents
                        ? ` · setup ${money(a.setupFeeCents, a.currency ?? "USD")}`
                        : ""}
                    </p>
                    <p className="mt-1 text-sx-xs text-[var(--text-secondary)]">
                      {a.desc}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <SxButton
                      variant="secondary"
                      size="sm"
                      onClick={() => openAddonForEdit(a)}
                    >
                      Edit
                    </SxButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SxPanel>
      )}

      {/* Plan editor */}
      {editingPlanId ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"
          onClick={() => !savingPlan && closePlanEditor()}
        >
          <div
            role="dialog"
            aria-modal
            className="w-full max-w-2xl overflow-auto rounded-sx-xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-sx-xl"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={(e) => void savePlan(e)} className="p-6">
              <h2 className="font-display text-sx-xl font-semibold text-[var(--text-primary)]">
                {editingPlanId === "new" ? "New plan" : "Edit plan"}
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <SxInput
                  label="Code"
                  value={planForm.code ?? ""}
                  onChange={(e) => setPlanField("code", e.target.value)}
                  placeholder="growth"
                  required
                />
                <SxInput
                  label="Name"
                  value={planForm.name ?? ""}
                  onChange={(e) => setPlanField("name", e.target.value)}
                  placeholder="Growth"
                  required
                />
                <SxInput
                  label="Monthly price (cents)"
                  type="number"
                  value={String(planForm.priceMonthlyCents ?? 0)}
                  onChange={(e) =>
                    setPlanField("priceMonthlyCents", Number(e.target.value) || 0)
                  }
                />
                <SxInput
                  label="Yearly price (cents)"
                  type="number"
                  value={String(planForm.priceYearlyCents ?? 0)}
                  onChange={(e) =>
                    setPlanField("priceYearlyCents", Number(e.target.value) || 0)
                  }
                />
                <SxInput
                  label="Currency"
                  value={planForm.currency ?? "USD"}
                  onChange={(e) => setPlanField("currency", e.target.value)}
                />
                <SxInput
                  label="Trial (days)"
                  type="number"
                  value={String(planForm.trialDays ?? 0)}
                  onChange={(e) =>
                    setPlanField("trialDays", Number(e.target.value) || 0)
                  }
                />
                <SxInput
                  label="Edit credits / period"
                  type="number"
                  value={String(planForm.includedEditCreditsPerPeriod ?? 0)}
                  onChange={(e) =>
                    setPlanField(
                      "includedEditCreditsPerPeriod",
                      Number(e.target.value) || 0,
                    )
                  }
                />
                <SxTextarea
                  label="Description"
                  value={planForm.description ?? ""}
                  onChange={(e) => setPlanField("description", e.target.value)}
                  containerClassName="sm:col-span-2"
                  rows={2}
                />
                <SxTextarea
                  label="Features (one per line)"
                  value={planFeaturesText}
                  onChange={(e) => setPlanFeaturesText(e.target.value)}
                  containerClassName="sm:col-span-2"
                  rows={4}
                />
                <label className="flex items-center gap-2 text-sx-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={planForm.isActive ?? true}
                    onChange={(e) => setPlanField("isActive", e.target.checked)}
                    className="h-4 w-4 accent-[var(--color-brand-500)]"
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sx-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={planForm.billingMonthlyEnabled ?? true}
                    onChange={(e) =>
                      setPlanField("billingMonthlyEnabled", e.target.checked)
                    }
                    className="h-4 w-4 accent-[var(--color-brand-500)]"
                  />
                  Allow monthly billing
                </label>
                <label className="flex items-center gap-2 text-sx-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={planForm.billingYearlyEnabled ?? true}
                    onChange={(e) =>
                      setPlanField("billingYearlyEnabled", e.target.checked)
                    }
                    className="h-4 w-4 accent-[var(--color-brand-500)]"
                  />
                  Allow yearly billing
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <SxButton
                  type="button"
                  variant="secondary"
                  onClick={closePlanEditor}
                  disabled={savingPlan}
                >
                  Cancel
                </SxButton>
                <SxButton type="submit" loading={savingPlan}>
                  {editingPlanId === "new" ? "Create plan" : "Save plan"}
                </SxButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Add-on editor */}
      {editingAddonId ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"
          onClick={() => !savingAddon && closeAddonEditor()}
        >
          <div
            role="dialog"
            aria-modal
            className="w-full max-w-2xl overflow-auto rounded-sx-xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-sx-xl"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={(e) => void saveAddon(e)} className="p-6">
              <h2 className="font-display text-sx-xl font-semibold text-[var(--text-primary)]">
                {editingAddonId === "new" ? "New add-on" : "Edit add-on"}
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <SxInput
                  label="Code"
                  value={addonForm.code}
                  onChange={(e) =>
                    setAddonForm((prev) => ({ ...prev, code: e.target.value }))
                  }
                  required
                />
                <SxInput
                  label="Label"
                  value={addonForm.label}
                  onChange={(e) =>
                    setAddonForm((prev) => ({ ...prev, label: e.target.value }))
                  }
                  required
                />
                <SxInput
                  label="Price (cents)"
                  type="number"
                  value={String(addonForm.priceCents ?? 0)}
                  onChange={(e) =>
                    setAddonForm((prev) => ({
                      ...prev,
                      priceCents: Number(e.target.value) || 0,
                    }))
                  }
                />
                <SxInput
                  label="Setup fee (cents)"
                  type="number"
                  value={String(addonForm.setupFeeCents ?? 0)}
                  onChange={(e) =>
                    setAddonForm((prev) => ({
                      ...prev,
                      setupFeeCents: Number(e.target.value) || 0,
                    }))
                  }
                />
                <SxInput
                  label="Currency"
                  value={addonForm.currency ?? "USD"}
                  onChange={(e) =>
                    setAddonForm((prev) => ({
                      ...prev,
                      currency: e.target.value,
                    }))
                  }
                />
                <SxSelect
                  label="Billing kind"
                  value={addonForm.billingKind ?? "one_time"}
                  onChange={(e) =>
                    setAddonForm((prev) => ({
                      ...prev,
                      billingKind: e.target.value as
                        | "recurring"
                        | "one_time"
                        | "per_use",
                    }))
                  }
                >
                  <option value="one_time">One-time</option>
                  <option value="recurring">Recurring</option>
                  <option value="per_use">Per use</option>
                </SxSelect>
                <SxTextarea
                  label="Description"
                  value={addonForm.desc ?? ""}
                  onChange={(e) =>
                    setAddonForm((prev) => ({ ...prev, desc: e.target.value }))
                  }
                  containerClassName="sm:col-span-2"
                  rows={3}
                />
                <label className="flex items-center gap-2 text-sx-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={addonForm.isActive !== false}
                    onChange={(e) =>
                      setAddonForm((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-[var(--color-brand-500)]"
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sx-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={addonForm.billingMonthlyEnabled ?? false}
                    onChange={(e) =>
                      setAddonForm((prev) => ({
                        ...prev,
                        billingMonthlyEnabled: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-[var(--color-brand-500)]"
                  />
                  Allow monthly
                </label>
                <label className="flex items-center gap-2 text-sx-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={addonForm.billingYearlyEnabled ?? false}
                    onChange={(e) =>
                      setAddonForm((prev) => ({
                        ...prev,
                        billingYearlyEnabled: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-[var(--color-brand-500)]"
                  />
                  Allow yearly
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <SxButton
                  type="button"
                  variant="secondary"
                  onClick={closeAddonEditor}
                  disabled={savingAddon}
                >
                  Cancel
                </SxButton>
                <SxButton type="submit" loading={savingAddon}>
                  {editingAddonId === "new" ? "Create add-on" : "Save add-on"}
                </SxButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <SxConfirmDialog
        open={deletePlanId !== null}
        title="Archive this plan?"
        body="Existing subscribers stay on it. New customers won't see it at checkout. You can edit it later to set Active back on."
        confirmLabel="Archive plan"
        destructive
        loading={deletingPlan}
        onConfirm={() => void confirmDeletePlan()}
        onCancel={() => !deletingPlan && setDeletePlanId(null)}
      />
    </div>
  );
}
