import { useEffect, useMemo, useState } from "react";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import {
  deletePlanFeatureOverride,
  fetchAdminPlans,
  fetchFeatureFlagsAdmin,
  patchAdminFeatureFlag,
  upsertPlanFeatureOverride,
} from "@/services/subscriptionsApi";
import type {
  FeatureFlagRow,
  FeatureFlagsAdminPayload,
  Plan,
  PlanFeatureOverrideRow,
} from "@/types/subscription";
import { SxBadge } from "@/components/sx/Badge";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";

type OverrideValue = "inherit" | "on" | "off";

function effectiveValue(
  flag: FeatureFlagRow,
  overrides: PlanFeatureOverrideRow[],
  planId: string,
): OverrideValue {
  const o = overrides.find((x) => x.planId === planId && x.key === flag.key);
  if (!o) return "inherit";
  return o.enabled ? "on" : "off";
}

export function FeatureControlsPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const toast = useSxToast();
  const [data, setData] = useState<FeatureFlagsAdminPayload | null>(
    cache.featureFlags ?? null,
  );
  const [plans, setPlans] = useState<Plan[]>(cache.plans ?? []);
  const [loading, setLoading] = useState(!cache.featureFlags);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [busyOverride, setBusyOverride] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchFeatureFlagsAdmin(),
      plans.length === 0 ? fetchAdminPlans() : Promise.resolve(plans),
    ])
      .then(([flags, p]) => {
        if (cancelled) return;
        setData(flags);
        setPlans(p);
        updateCache({ featureFlags: flags, plans: p });
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load feature flags.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const flags = data?.flags ?? [];
  const overrides = data?.overrides ?? [];

  const sortedPlans = useMemo(
    () =>
      [...plans].sort(
        (a, b) => (a.priceMonthlyCents ?? 0) - (b.priceMonthlyCents ?? 0),
      ),
    [plans],
  );

  async function toggleGlobal(flag: FeatureFlagRow, next: boolean) {
    setBusyKey(flag.key);
    try {
      await patchAdminFeatureFlag(flag.key, next);
      setData((prev) =>
        prev
          ? {
              ...prev,
              flags: prev.flags.map((f) =>
                f.key === flag.key ? { ...f, enabled: next } : f,
              ),
            }
          : prev,
      );
      toast.success(`${flag.label}: ${next ? "on" : "off"} globally.`);
    } catch (err) {
      toast.error(
        "Couldn't update flag.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function setOverride(
    flag: FeatureFlagRow,
    plan: Plan,
    value: OverrideValue,
  ) {
    const id = `${plan.id}:${flag.key}`;
    setBusyOverride(id);
    try {
      if (value === "inherit") {
        await deletePlanFeatureOverride(plan.id, flag.key);
        setData((prev) =>
          prev
            ? {
                ...prev,
                overrides: prev.overrides.filter(
                  (o) => !(o.planId === plan.id && o.key === flag.key),
                ),
              }
            : prev,
        );
      } else {
        const enabled = value === "on";
        await upsertPlanFeatureOverride(plan.id, flag.key, enabled);
        setData((prev) => {
          if (!prev) return prev;
          const existing = prev.overrides.find(
            (o) => o.planId === plan.id && o.key === flag.key,
          );
          if (existing) {
            return {
              ...prev,
              overrides: prev.overrides.map((o) =>
                o.planId === plan.id && o.key === flag.key
                  ? { ...o, enabled }
                  : o,
              ),
            };
          }
          return {
            ...prev,
            overrides: [
              ...prev.overrides,
              {
                id,
                planId: plan.id,
                key: flag.key,
                enabled,
                plan: { id: plan.id, name: plan.name, code: plan.code },
              },
            ],
          };
        });
      }
      toast.success("Override saved.");
    } catch (err) {
      toast.error(
        "Couldn't save override.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setBusyOverride(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-[var(--border-subtle)] pb-4">
        <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Settings
        </p>
        <h1 className="mt-1.5 font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          Feature flags
        </h1>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">
          Global on/off plus per-plan overrides. Overrides win over global. Inherit follows global.
        </p>
      </header>

      {loading ? (
        <p className="text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
      ) : flags.length === 0 ? (
        <SxPanel>
          <p className="text-sx-sm text-[var(--text-tertiary)]">No feature flags defined.</p>
        </SxPanel>
      ) : (
        <SxPanel padded={false} bodyClassName="p-4">
          <div className="flex flex-col gap-3">
            {flags.map((flag) => {
              const busy = busyKey === flag.key;
              return (
                <article
                  key={flag.key}
                  className="rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-ui text-sx-sm font-semibold text-[var(--text-primary)]">
                          {flag.label}
                        </p>
                        <SxBadge
                          variant={flag.enabled ? "success" : "neutral"}
                          withDot={false}
                        >
                          {flag.enabled ? "On" : "Off"}
                        </SxBadge>
                      </div>
                      <p className="mt-0.5 font-mono text-sx-2xs text-[var(--text-tertiary)]">
                        {flag.key}
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sx-xs text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={flag.enabled}
                        disabled={busy}
                        onChange={(e) => void toggleGlobal(flag, e.target.checked)}
                        className="h-4 w-4 accent-[var(--color-brand-500)]"
                      />
                      Global default
                    </label>
                  </div>

                  {sortedPlans.length > 0 ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {sortedPlans.map((plan) => {
                        const value = effectiveValue(
                          flag,
                          overrides,
                          plan.id,
                        );
                        const oId = `${plan.id}:${flag.key}`;
                        const oBusy = busyOverride === oId;
                        return (
                          <div
                            key={plan.id}
                            className="flex items-center justify-between gap-3 rounded-sx-sm border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2"
                          >
                            <p className="truncate text-sx-xs text-[var(--text-primary)]">
                              {plan.name}
                            </p>
                            <div className="flex gap-1">
                              {(
                                [
                                  ["inherit", "Inherit"],
                                  ["on", "On"],
                                  ["off", "Off"],
                                ] as const
                              ).map(([k, label]) => {
                                const active = value === k;
                                return (
                                  <button
                                    key={k}
                                    type="button"
                                    disabled={oBusy}
                                    onClick={() =>
                                      void setOverride(flag, plan, k)
                                    }
                                    className={[
                                      "rounded-sx-sm px-2 py-1 font-ui text-sx-2xs font-semibold transition-colors",
                                      active
                                        ? "bg-[var(--color-brand-500)] text-white"
                                        : "bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--surface-page)]",
                                    ].join(" ")}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </SxPanel>
      )}
    </div>
  );
}
