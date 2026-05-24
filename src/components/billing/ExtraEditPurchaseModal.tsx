import {
  maxPurchasableExtraEditCredits,
  totalWebsiteEditCreditsAvailable,
} from "@/lib/websiteEditCreditsLimit";
import { buildExtraEditCheckoutCart, saveAddonCheckoutCart } from "@/services/addonCheckoutCart";
import type { ProjectUsageSnapshot } from "@/types/project";
import type { Plan, SubscriptionAddon } from "@/types/subscription";
import { portal } from "@/components/portal/portalStyles";
import { PortalOverlay } from "@/components/ui/PortalOverlay";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  projectName?: string;
  plan: Plan | null | undefined;
  usage: ProjectUsageSnapshot | null | undefined;
  singleAddon: SubscriptionAddon | null | undefined;
  bundleAddon: SubscriptionAddon | null | undefined;
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
  projectName,
  plan,
  usage,
  singleAddon,
  bundleAddon,
  currency,
  perEditCents,
  bundleCredits,
  bundleCents,
  busy,
  setBusy: _setBusy,
  onNotice,
  baseReturnUrl: _baseReturnUrl,
  companionAddonCodes = [],
}: Props) {
  const navigate = useNavigate();
  const canSingle = Boolean(singleAddon);
  const canBundle = Boolean(bundleAddon);
  const [mode, setMode] = useState<"per_edit" | "bundle">("per_edit");
  const [qty, setQty] = useState(1);

  const creditsAvailable = useMemo(() => totalWebsiteEditCreditsAvailable(usage), [usage]);
  const showDepletedAlert = creditsAvailable <= 0;
  const maxBuy = useMemo(
    () => maxPurchasableExtraEditCredits(usage, plan),
    [usage, plan],
  );

  const bundleListCents = perEditCents * Math.max(1, bundleCredits);
  const bundleSavePct =
    bundleListCents > 0 && bundleCents > 0 && bundleListCents > bundleCents
      ? Math.round(((bundleListCents - bundleCents) / bundleListCents) * 100)
      : 0;

  useEffect(() => {
    if (!open) return;
    if (!canSingle && canBundle) setMode("bundle");
    else if (canSingle && !canBundle) setMode("per_edit");
    else setMode("per_edit");
    setQty(1);
  }, [open, canSingle, canBundle]);

  if (!open) return null;

  const effectiveQty = Math.max(1, Math.min(maxBuy, qty));
  const perEditTotalCents = perEditCents * effectiveQty;
  const dueTodayCents = mode === "per_edit" ? perEditTotalCents : bundleCents;

  function addToCheckout() {
    onNotice(null);
    if (mode === "per_edit") {
      if (!canSingle || perEditCents <= 0) {
        onNotice("Per-edit purchases are not available for this plan.");
        return;
      }
    } else if (!canBundle || bundleCredits <= 0 || bundleCents <= 0) {
      onNotice("The edit bundle is not available for this plan.");
      return;
    }

    const checkoutReturnUrl = `${window.location.origin}/projects/${projectId}/add-ons/checkout`;
    const cart = buildExtraEditCheckoutCart({
      projectId,
      mode,
      quantity: effectiveQty,
      perEditCents,
      bundleCredits,
      bundleCents,
      currency,
      singleAddon: singleAddon ?? null,
      bundleAddon: bundleAddon ?? null,
      companionAddonCodes,
      returnUrl: checkoutReturnUrl,
    });
    saveAddonCheckoutCart(cart);
    onClose();
    navigate(`/projects/${projectId}/add-ons/checkout`);
  }

  return (
    <PortalOverlay
      open={open}
      onClose={busy ? undefined : onClose}
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="extra-edit-purchase-title"
        className="w-full max-w-lg rounded-2xl border border-on-surface/10 bg-surface-container-lowest text-on-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-on-surface/10 px-6 py-5">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-light text-accent-gold">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <div>
              <h3 id="extra-edit-purchase-title" className="font-h3 text-h3 font-bold text-on-surface">
                Purchase Edit Credits
              </h3>
              {projectName ? (
                <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                  For project {projectName}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {showDepletedAlert ? (
            <div className="flex gap-3 rounded-lg border border-rose-500/25 bg-rose-500/10 px-4 py-3">
              <span className="text-rose-600" aria-hidden>
                !
              </span>
              <p className="font-body-sm text-body-sm leading-relaxed text-rose-800">
                You have {creditsAvailable} edit credits remaining. Purchase more to request further website
                updates.
              </p>
            </div>
          ) : null}

          <p className="font-caption text-caption font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
            Select an option
          </p>

          <div className="space-y-3">
            {canSingle ? (
              <label
                className={`block cursor-pointer rounded-lg border p-4 transition ${
                  mode === "per_edit"
                    ? "border-accent-gold ring-1 ring-accent-gold/20"
                    : "border-on-surface/10 bg-surface-container-lowest"
                }`}
              >
                <div className="flex gap-3">
                  <input
                    type="radio"
                    name="extraEditMode"
                    checked={mode === "per_edit"}
                    onChange={() => setMode("per_edit")}
                    className="mt-1 accent-accent-gold"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-body font-semibold text-on-surface">Individual Credits</p>
                    <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                      {money(perEditCents, currency)} per credit. Buy exactly what you need.
                    </p>
                    {mode === "per_edit" ? (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center rounded-lg border border-on-surface/15">
                          <button
                            type="button"
                            disabled={busy || effectiveQty <= 1}
                            onClick={(e) => {
                              e.preventDefault();
                              setQty((q) => Math.max(1, q - 1));
                            }}
                            className="px-3 py-1.5 text-lg text-on-surface-variant hover:bg-surface-container disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="min-w-[2rem] px-2 text-center font-semibold tabular-nums">
                            {effectiveQty}
                          </span>
                          <button
                            type="button"
                            disabled={busy || effectiveQty >= maxBuy}
                            onClick={(e) => {
                              e.preventDefault();
                              setQty((q) => Math.min(maxBuy, q + 1));
                            }}
                            className="px-3 py-1.5 text-lg text-on-surface-variant hover:bg-surface-container disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          Total:{" "}
                          <span className="font-semibold text-on-surface">
                            {money(perEditTotalCents, currency)}
                          </span>
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </label>
            ) : null}

            {canBundle ? (
              <label
                className={`relative block cursor-pointer rounded-lg border p-4 transition ${
                  mode === "bundle"
                    ? "border-accent-gold ring-1 ring-accent-gold/20"
                    : "border-on-surface/10"
                }`}
              >
                {bundleSavePct > 0 ? (
                  <span className="absolute right-3 top-3 rounded bg-accent-gold px-2 py-0.5 font-caption text-[10px] font-bold uppercase tracking-wide text-white">
                    Save {bundleSavePct}%
                  </span>
                ) : null}
                <div className="flex gap-3">
                  <input
                    type="radio"
                    name="extraEditMode"
                    checked={mode === "bundle"}
                    onChange={() => setMode("bundle")}
                    className="mt-1 accent-accent-gold"
                  />
                  <div className="min-w-0 flex-1 pr-16">
                    <p className="font-body font-semibold text-on-surface">
                      {bundleCredits} Credit Bundle
                    </p>
                    <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                      Stock up and save on future edit requests.
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-h3 text-h3 font-bold tabular-nums text-on-surface">
                      {money(bundleCents, currency)}
                    </p>
                    {bundleListCents > bundleCents ? (
                      <p className="font-body-sm text-body-sm text-on-surface-variant line-through">
                        {money(bundleListCents, currency)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </label>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-on-surface/10 px-6 py-4">
          <div>
            <p className="font-caption text-caption font-semibold uppercase tracking-wider text-on-surface-variant">
              Due today
            </p>
            <p className="font-h2 text-h2 font-bold tabular-nums text-on-surface">
              {money(dueTodayCents, currency)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => onClose()}
              className="font-body text-sm font-semibold text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || (!canSingle && !canBundle)}
              onClick={() => addToCheckout()}
              className={
                portal.btnPrimary +
                " inline-flex items-center gap-2 !px-5 !py-2.5 !text-sm"
              }
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
              {busy ? "Starting…" : "Add to Checkout"}
            </button>
          </div>
        </div>
      </div>
    </PortalOverlay>
  );
}
