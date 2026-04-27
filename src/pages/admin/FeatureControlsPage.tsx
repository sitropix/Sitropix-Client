import { useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { isModuleForbiddenError } from "@/services/http";
import {
  deletePlanFeatureOverride,
  fetchAdminPlans,
  fetchFeatureFlagsAdmin,
  patchAdminFeatureFlag,
  upsertPlanFeatureOverride,
} from "@/services/subscriptionsApi";
import type { FeatureFlagsAdminPayload, Plan } from "@/types/subscription";

const FLAG_KEYS = ["subscription_pause_resume", "subscription_self_cancel"] as const;
const FLAG_KEY_SET = new Set<string>(FLAG_KEYS);

export function FeatureControlsPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const [payload, setPayload] = useState<FeatureFlagsAdminPayload | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [noModuleAccess, setNoModuleAccess] = useState(false);

  async function load() {
    setLoading(!(payload || plans.length));
    setNoModuleAccess(false);
    setNotice(null);
    try {
      const [f, p] = await Promise.all([fetchFeatureFlagsAdmin(), fetchAdminPlans()]);
      setPayload(f);
      setPlans(p.filter((x) => !x.archivedAt));
      updateCache({ featureFlags: f, plans: p });
    } catch (err) {
      if (isModuleForbiddenError(err)) {
        setNoModuleAccess(true);
      } else {
      setNotice("Could not load feature settings.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cache.featureFlags) setPayload(cache.featureFlags);
    if (cache.plans) setPlans(cache.plans.filter((x) => !x.archivedAt));
    if (cache.featureFlags && cache.plans) {
      setLoading(false);
      return;
    }
    void load();
  }, []);

  const overrideFor = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const o of payload?.overrides ?? []) {
      m.set(`${o.planId}:${o.key}`, o.enabled);
    }
    return m;
  }, [payload?.overrides]);

  async function toggleGlobal(key: string, enabled: boolean) {
    await patchAdminFeatureFlag(key, enabled);
    await load();
  }

  async function setPlanOverride(planId: string, key: (typeof FLAG_KEYS)[number], mode: "inherit" | "on" | "off") {
    if (mode === "inherit") await deletePlanFeatureOverride(planId, key);
    else await upsertPlanFeatureOverride(planId, key, mode === "on");
    await load();
  }

  function triState(planId: string, key: (typeof FLAG_KEYS)[number]): "inherit" | "on" | "off" {
    const k = `${planId}:${key}`;
    if (!overrideFor.has(k)) return "inherit";
    return overrideFor.get(k) ? "on" : "off";
  }

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Feature Controls" />;
  }

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Admin" }, { label: "Feature controls" }]} />
      <header>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Feature controls</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Global switches apply to all plans unless a plan override is set. Client UI and API enforce these in real time.
        </p>
      </header>

      {notice && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{notice}</p>}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-sm font-semibold text-white">Global</h2>
        {loading ? (
          <p className="mt-3 text-sm text-ink-muted">Loading…</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {(payload?.flags ?? [])
              .filter((f) => FLAG_KEY_SET.has(f.key))
              .map((f) => (
                <li key={f.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{f.label}</p>
                    <p className="text-xs text-ink-subtle">{f.key}</p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
                    <span>{f.enabled ? "On" : "Off"}</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-lime"
                      checked={f.enabled}
                      onChange={(e) => void toggleGlobal(f.key, e.target.checked)}
                    />
                  </label>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-sm font-semibold text-white">Per-plan overrides</h2>
        <p className="mt-1 text-sm text-ink-muted">Use overrides for grandfathered tiers or pilot programs. Inherit follows the global switch.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-ink-muted">
                <th className="py-2 pr-4 font-medium">Plan</th>
                <th className="py-2 pr-4 font-medium">Pause / resume</th>
                <th className="py-2 font-medium">Self cancel</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b border-white/5">
                  <td className="py-3 pr-4 text-white">{plan.name}</td>
                  <td className="py-3 pr-4">
                    <select
                      className="rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:border-brand-lime/35"
                      value={triState(plan.id, "subscription_pause_resume")}
                      onChange={(e) =>
                        void setPlanOverride(plan.id, "subscription_pause_resume", e.target.value as "inherit" | "on" | "off")
                      }
                    >
                      <option value="inherit">Inherit</option>
                      <option value="on">Force on</option>
                      <option value="off">Force off</option>
                    </select>
                  </td>
                  <td className="py-3">
                    <select
                      className="rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:border-brand-lime/35"
                      value={triState(plan.id, "subscription_self_cancel")}
                      onChange={(e) =>
                        void setPlanOverride(plan.id, "subscription_self_cancel", e.target.value as "inherit" | "on" | "off")
                      }
                    >
                      <option value="inherit">Inherit</option>
                      <option value="on">Force on</option>
                      <option value="off">Force off</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
