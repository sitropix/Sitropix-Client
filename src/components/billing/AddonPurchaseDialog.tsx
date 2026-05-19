import { AddonRecurringPriceBreakdown } from "@/components/billing/addonDisplay";
import { portal } from "@/components/portal/portalStyles";
import { billingCycleLabel } from "@/lib/addonDisplayHelpers";
import { PortalOverlay } from "@/components/ui/PortalOverlay";
import type { ProjectRecord } from "@/types/project";
import type { SubscriptionAddon } from "@/types/subscription";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  addon: SubscriptionAddon | null;
  addons?: SubscriptionAddon[];
  project: ProjectRecord | null;
  priceLabel: string;
  dueTodayCents: number;
  currency?: string;
  caption?: string | null;
  breakdownAddon?: SubscriptionAddon | null;
  busy?: boolean;
  preparing?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onConfirm: () => void;
  footerNote?: ReactNode;
};

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

export function AddonPurchaseDialog({
  open,
  addon,
  addons,
  project,
  priceLabel,
  dueTodayCents,
  currency = "USD",
  breakdownAddon,
  busy = false,
  preparing = false,
  errorMessage = null,
  onClose,
  onConfirm,
  footerNote,
}: Props) {
  const items = addons?.length ? addons : addon ? [addon] : [];
  if (!items.length) return null;

  const primary = addon ?? items[0];
  const breakdownSource = breakdownAddon ?? primary;
  const isRecurring = primary.billingKind === "recurring";

  return (
    <PortalOverlay open={open} onClose={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal
        aria-labelledby="addon-purchase-title"
        className="flex max-h-[min(92dvh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-on-surface/10 bg-surface-container-lowest text-on-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-on-surface/10 px-6 py-4">
          <div>
            <h2 id="addon-purchase-title" className="font-h2 text-h2 font-bold text-on-surface">
              Item details
            </h2>
            <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
              Review your add-on before secure checkout.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            {items.map((item) => (
              <article
                key={item.code}
                className="rounded-lg border border-on-surface/10 bg-surface-container-lowest p-5 shadow-sm"
              >
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-light text-accent-gold">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                      <circle cx="9" cy="21" r="1" />
                      <circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-body text-body-lg font-semibold text-on-surface">{item.label}</h3>
                      {isRecurring ? (
                        <span className="rounded bg-surface-container px-2 py-0.5 font-caption text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          Recurring
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
                      {item.desc}
                    </p>
                    {project ? (
                      <ul className="mt-3 space-y-1 font-caption text-caption text-on-surface-variant">
                        <li>
                          <span className="font-semibold text-on-surface">Project:</span> {project.name}
                        </li>
                        {isRecurring ? (
                          <li>
                            <span className="font-semibold text-on-surface">Billing cycle:</span>{" "}
                            {billingCycleLabel(project)}
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}

            <section>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-body font-semibold text-on-surface">Payment method</h3>
                <span className="font-caption text-caption text-accent-gold">Managed at checkout</span>
              </div>
              <p className="rounded-lg border border-dashed border-on-surface/15 bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">
                You will enter or confirm your card on the secure Stripe checkout page after clicking Complete
                purchase.
              </p>
            </section>
          </div>

          <aside className="h-fit rounded-lg border border-on-surface/10 bg-surface-container-low p-5 lg:sticky lg:top-0">
            <h3 className="font-body font-semibold text-on-surface">Order summary</h3>
            <div className="mt-4 space-y-2 font-body-sm text-body-sm">
              {items.map((item) => (
                <div key={item.code} className="flex justify-between gap-2 text-on-surface-variant">
                  <span className="min-w-0 truncate">{item.label}</span>
                  <span className="shrink-0 tabular-nums font-medium text-on-surface">
                    {money(item.priceCents ?? 0, item.currency || currency)}
                  </span>
                </div>
              ))}
              {breakdownSource.billingKind === "recurring" && (breakdownSource.setupFeeCents ?? 0) > 0 ? (
                <AddonRecurringPriceBreakdown addon={breakdownSource} currency={currency} />
              ) : null}
              <div className="border-t border-on-surface/10 pt-3">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Subtotal</span>
                  <span className="tabular-nums font-medium text-on-surface">{priceLabel}</span>
                </div>
                <div className="mt-1 flex justify-between text-on-surface-variant">
                  <span>Taxes</span>
                  <span className="tabular-nums">$0.00</span>
                </div>
              </div>
            </div>
            <div className="mt-4 border-t border-on-surface/10 pt-4">
              <p className="font-caption text-caption uppercase tracking-wider text-on-surface-variant">
                Due today
              </p>
              <p className="mt-1 font-h2 text-h2 font-bold tabular-nums text-accent-gold">
                {money(dueTodayCents, currency)}
              </p>
            </div>
            {isRecurring ? (
              <p className="mt-3 flex gap-2 rounded-lg border border-on-surface/8 bg-surface-container-lowest px-3 py-2 font-caption text-[11px] leading-snug text-on-surface-variant">
                <span className="text-accent-gold" aria-hidden>
                  ⓘ
                </span>
                Recurring add-ons renew with your base plan unless you cancel from billing settings.
              </p>
            ) : null}
            {errorMessage ? (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-body-sm text-body-sm text-rose-800"
              >
                {errorMessage}
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy || preparing}
              onClick={onConfirm}
              className={portal.btnPrimary + " mt-4 flex w-full items-center justify-center gap-2 !py-3 !text-sm"}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              {busy ? "Starting checkout…" : preparing ? "Preparing billing…" : "Complete purchase"}
            </button>
            {footerNote ? (
              <p className="mt-3 text-center font-caption text-[11px] text-on-surface-variant">{footerNote}</p>
            ) : (
              <p className="mt-3 text-center font-caption text-[11px] text-on-surface-variant">
                By completing this purchase, you agree to our Terms of Service.
              </p>
            )}
          </aside>
        </div>
      </div>
    </PortalOverlay>
  );
}
