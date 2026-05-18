import {
  addonPlanPricingMode,
  planPricingFromRows,
  pricingRowsFromMap,
  type AddonPlanPricing,
  type AddonPlanPricingRow,
} from "@/lib/addonPlanPricing";
import type { Plan, SubscriptionAddon } from "@/types/subscription";
import type { ReactNode } from "react";

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
      {children}
    </span>
  );
}

type Props = {
  addon: Pick<
    SubscriptionAddon,
    "catalogJson" | "billingKind" | "billingMonthlyEnabled" | "billingYearlyEnabled"
  >;
  plans: Plan[];
  pricing: AddonPlanPricing;
  onChange: (next: AddonPlanPricing) => void;
  showCredits?: boolean;
};

export function AddonPlanPricingEditor({ addon, plans, pricing, onChange, showCredits }: Props) {
  const mode = addonPlanPricingMode(addon);
  const credits = showCredits ?? mode === "one_time";
  const rows = pricingRowsFromMap(plans, pricing, {
    showCredits: credits,
    mode,
  });

  function applyRows(nextRows: AddonPlanPricingRow[]) {
    onChange(
      planPricingFromRows(nextRows, {
        showCredits: credits,
        mode,
      }),
    );
  }

  function patchRow(planCode: string, patch: Partial<AddonPlanPricingRow>) {
    applyRows(rows.map((r) => (r.planCode === planCode ? { ...r, ...patch } : r)));
  }

  return (
    <div className="rounded border border-[#2A3037]/80 bg-[#15191C] p-3">
      <FieldLabel>
        {mode === "recurring" ? "Plan pricing (monthly & yearly)" : "Plan pricing"}
      </FieldLabel>
      <p className="mt-1 text-[10px] leading-snug text-zinc-500">
        {mode === "recurring"
          ? "Set recurring add-on prices per subscription plan. Checkout uses the price that matches the project's billing cycle."
          : "Set one-time add-on prices per plan. Leave a row empty to disable purchase on that plan."}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-[11px]">
          <thead>
            <tr className="text-zinc-500">
              <th className="pb-1.5 pr-2 font-medium">Plan</th>
              {mode === "recurring" ? (
                <>
                  <th className="pb-1.5 pr-2 font-medium">Monthly ($)</th>
                  <th className="pb-1.5 pr-2 font-medium">Yearly ($)</th>
                </>
              ) : (
                <th className="pb-1.5 pr-2 font-medium">Price ($)</th>
              )}
              {credits ? <th className="pb-1.5 font-medium">Credits</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.planCode} className="border-t border-[#24292E]/80">
                <td className="py-2 pr-2 align-top text-zinc-300">
                  <span className="font-medium text-white">{row.planName}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-zinc-500">
                    {row.planCode}
                  </span>
                </td>
                {mode === "recurring" ? (
                  <>
                    <td className="py-2 pr-2 align-top">
                      <label className="sr-only">Monthly price for {row.planName}</label>
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={row.monthlyUsd}
                        onChange={(e) =>
                          patchRow(row.planCode, { monthlyUsd: e.target.value })
                        }
                        placeholder="—"
                        aria-label={`Monthly price (${row.planName})`}
                        className="w-full max-w-[6.5rem] rounded border border-[#24292E] bg-[#1C2126] px-2 py-1 text-white"
                      />
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <label className="sr-only">Yearly price for {row.planName}</label>
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={row.yearlyUsd}
                        onChange={(e) =>
                          patchRow(row.planCode, { yearlyUsd: e.target.value })
                        }
                        placeholder="—"
                        aria-label={`Yearly price (${row.planName})`}
                        className="w-full max-w-[6.5rem] rounded border border-[#24292E] bg-[#1C2126] px-2 py-1 text-white"
                      />
                    </td>
                  </>
                ) : (
                  <td className="py-2 pr-2 align-top">
                    <label className="sr-only">Price for {row.planName}</label>
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={row.priceUsd}
                      onChange={(e) => patchRow(row.planCode, { priceUsd: e.target.value })}
                      placeholder="—"
                      aria-label={`Price (${row.planName})`}
                      className="w-full max-w-[6.5rem] rounded border border-[#24292E] bg-[#1C2126] px-2 py-1 text-white"
                    />
                  </td>
                )}
                {credits ? (
                  <td className="py-2 align-top">
                    <label className="sr-only">Credits for {row.planName}</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={row.credits}
                      onChange={(e) => patchRow(row.planCode, { credits: e.target.value })}
                      placeholder="—"
                      aria-label={`Credits (${row.planName})`}
                      className="w-full max-w-[4.5rem] rounded border border-[#24292E] bg-[#1C2126] px-2 py-1 text-white"
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
