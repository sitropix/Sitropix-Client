import { EXTRA_EDIT_BUNDLE_CODE, EXTRA_EDIT_SINGLE_CODE } from "@/constants/extraEditAddons";
import {
  maxPurchasableExtraEditCredits,
  readPlanTotalWebsiteEditCreditsLimit,
  totalWebsiteEditCreditsAvailable,
} from "@/lib/websiteEditCreditsLimit";
import { createAddonCheckoutSession } from "@/services/subscriptionsApi";
import type { ProjectUsageSnapshot } from "@/types/project";
import type { Plan, SubscriptionAddon } from "@/types/subscription";
import { useEffect, useMemo, useState } from "react";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  plan: Plan | null | undefined;
  usage: ProjectUsageSnapshot | null | undefined;
  singleAddon: SubscriptionAddon | null | undefined;
  bundleAddon: SubscriptionAddon | null | undefined;
  /** Other add-on codes to include in the same Stripe checkout (e.g. from subscription page). */
  companionAddonCodes?: string[];
  currency: string;
  perEditCents: number;
  bundleCredits: number;
  bundleCents: number;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onNotice: (msg: string | null) => void;
  baseReturnUrl: string;
};

export function ExtraEditPurchaseModal({
  open,
  onClose,
  projectId,
  plan,
  usage,
  singleAddon,
  bundleAddon,
  currency,
  perEditCents,
  bundleCredits,
  bundleCents,
  busy,
  setBusy,
  onNotice,
  baseReturnUrl,
  companionAddonCodes = [],
}: Props) {
  const canSingle = Boolean(singleAddon);
  const canBundle = Boolean(bundleAddon);
  const [mode, setMode] = useState<"per_edit" | "bundle">("per_edit");
  const [qty, setQty] = useState(1);

  const maxBuy = useMemo(() => maxPurchasableExtraEditCredits(usage, plan), [usage, plan]);
  const creditsAvailable = useMemo(() => totalWebsiteEditCreditsAvailable(usage), [usage]);
  const planLimit = useMemo(() => readPlanTotalWebsiteEditCreditsLimit(plan), [plan]);

  useEffect(() => {
    if (!open) return;
    if (!canSingle && canBundle) setMode("bundle");
    else if (canSingle && !canBundle) setMode("per_edit");
    else setMode("per_edit");
    setQty(1);
  }, [open, canSingle, canBundle]);

  if (!open) return null;

  const effectiveQty = Math.min(Math.max(1, qty), Math.max(1, maxBuy));
  const perEditTotalCents = perEditCents * effectiveQty;

  async function startCheckout() {
    onNotice(null);
    if (mode === "per_edit") {
      if (!canSingle || perEditCents <= 0) {
        onNotice("Per-edit purchases are not available for this plan.");
        return;
      }
      if (maxBuy < 1) {
        onNotice(
          `You have ${creditsAvailable} edit credits and your plan allows at most ${planLimit} total. You cannot purchase more until you use credits or your plan changes.`,
        );
        return;
      }
      if (effectiveQty > maxBuy) {
        onNotice(`You can purchase at most ${maxBuy} extra edits without exceeding your plan limit.`);
        return;
      }
    } else {
      if (!canBundle || bundleCredits <= 0 || bundleCents <= 0) {
        onNotice("The edit bundle is not available for this plan.");
        return;
      }
      if (maxBuy < bundleCredits) {
        onNotice(
          `This bundle adds ${bundleCredits} credits but you may only add ${maxBuy} before reaching your plan limit of ${planLimit} total credits.`,
        );
        return;
      }
    }

    setBusy(true);
    try {
      const companion = companionAddonCodes.filter(Boolean);
      if (mode === "per_edit") {
        const singleCode = singleAddon?.code ?? EXTRA_EDIT_SINGLE_CODE;
        const codes = Array.from(new Set([...companion, singleCode]));
        const { url } = await createAddonCheckoutSession(projectId, codes, {
          successUrl: baseReturnUrl,
          cancelUrl: baseReturnUrl,
          extraEditCheckout: { mode: "per_edit", perEditQuantity: effectiveQty },
        });
        if (!url) {
          onNotice("Could not start checkout for extra edits.");
          return;
        }
        window.location.assign(url);
        return;
      }
      const bundleCode = bundleAddon?.code ?? EXTRA_EDIT_BUNDLE_CODE;
      const codes = Array.from(new Set([...companion, bundleCode]));
      const { url } = await createAddonCheckoutSession(projectId, codes, {
        successUrl: baseReturnUrl,
        cancelUrl: baseReturnUrl,
        extraEditCheckout: { mode: "bundle" },
      });
      if (!url) {
        onNotice("Could not start checkout for the edit bundle.");
        return;
      }
      window.location.assign(url);
    } catch (err) {
      onNotice(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal
      aria-labelledby="extra-edit-purchase-title"
      onClick={() => onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#2A3037] bg-[#15191C] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="extra-edit-purchase-title" className="text-lg font-bold text-white">
          Buy extra website edits
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          You have{" "}
          <span className="font-semibold text-zinc-200">{creditsAvailable}</span> credits available now.
          Your plan allows at most{" "}
          <span className="font-semibold text-zinc-200">{planLimit}</span> total (included + purchased pool).
        </p>

        <div className="mt-4 space-y-3">
          {canSingle ? (
            <label className="flex cursor-pointer gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-200">
              <input
                type="radio"
                name="extraEditMode"
                checked={mode === "per_edit"}
                onChange={() => setMode("per_edit")}
                className="accent-brand-lime"
              />
              <span>
                <span className="font-semibold text-white">Per edit</span>
                <span className="mt-1 block text-xs text-zinc-500">
                  {money(perEditCents, currency)} each — quantity × price at checkout.
                </span>
              </span>
            </label>
          ) : null}
          {canBundle ? (
            <label className="flex cursor-pointer gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-200">
              <input
                type="radio"
                name="extraEditMode"
                checked={mode === "bundle"}
                onChange={() => setMode("bundle")}
                className="accent-brand-lime"
              />
              <span>
                <span className="font-semibold text-white">Fixed bundle</span>
                <span className="mt-1 block text-xs text-zinc-500">
                  {bundleCredits} edits for {money(bundleCents, currency)} (single payment).
                </span>
              </span>
            </label>
          ) : null}
        </div>

        {mode === "per_edit" && canSingle ? (
          <div className="mt-4">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Number of edits
              </span>
              <input
                type="number"
                min={1}
                max={Math.max(1, maxBuy)}
                step={1}
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
                className="rounded-lg border border-[#2A3037] bg-[#101317] px-3 py-2 text-sm text-white"
              />
            </label>
            <p className="mt-2 text-xs text-zinc-400">
              Estimated total:{" "}
              <span className="font-semibold text-white">{money(perEditTotalCents, currency)}</span> (
              {effectiveQty} × {money(perEditCents, currency)}).
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">Max you can add now: {maxBuy}.</p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onClose()}
            className="rounded-xl border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || (!canSingle && !canBundle)}
            onClick={() => void startCheckout()}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-canvas hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Starting…" : "Continue to checkout"}
          </button>
        </div>
      </div>
    </div>
  );
}
