import { AddonRecurringPriceBreakdown } from "@/components/billing/addonDisplay";
import { MaterialIcon } from "@/components/MaterialIcon";
import { portal } from "@/components/portal/portalStyles";
import { billingCycleLabel } from "@/lib/addonDisplayHelpers";
import type { AddonCheckoutLineItem } from "@/services/addonCheckoutCart";
import type { ProjectRecord } from "@/types/project";
import type { SubscriptionAddon } from "@/types/subscription";
import type { ReactNode } from "react";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

type Props = {
  project: ProjectRecord;
  lineItems: AddonCheckoutLineItem[];
  dueTodayCents: number;
  currency: string;
  breakdownAddon?: SubscriptionAddon | null;
  busy?: boolean;
  preparing?: boolean;
  errorMessage?: string | null;
  onBack?: () => void;
  onConfirm: () => void;
  footerNote?: ReactNode;
};

export function AddonOrderReview({
  project,
  lineItems,
  dueTodayCents,
  currency,
  breakdownAddon,
  busy = false,
  preparing = false,
  errorMessage = null,
  onBack,
  onConfirm,
  footerNote,
}: Props) {
  const hasRecurring = lineItems.some((i) => i.isRecurring);
  const primaryRecurring = breakdownAddon ?? null;
  const detailItems = lineItems.filter((item) => !item.code.endsWith("_recurring"));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-8">
        <section>
          <h2 className="font-h2 text-h2 font-bold text-on-surface">Item details</h2>
          <div className="mt-4 space-y-4">
            {detailItems.map((item) => (
              <article
                key={item.code}
                className="rounded-xl border border-on-surface/10 bg-surface-container-lowest p-5 shadow-sm"
              >
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-light text-accent-gold">
                    <MaterialIcon name="inventory_2" className="!text-[22px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-body text-body-lg font-semibold text-on-surface">
                        {item.label.replace(/ Setup \(One-time fee\)$/, "").replace(/ Recurring \(Prorated\)$/, "")}
                      </h3>
                      {item.isRecurring ? (
                        <span className="rounded bg-surface-container px-2 py-0.5 font-caption text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          Recurring
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
                      {item.description}
                    </p>
                    <ul className="mt-3 space-y-1 font-caption text-caption text-on-surface-variant">
                      <li>
                        <span className="font-semibold text-on-surface">Project:</span> {project.name}
                      </li>
                      {item.isRecurring ? (
                        <li>
                          <span className="font-semibold text-on-surface">Billing cycle:</span>{" "}
                          {billingCycleLabel(project)}
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-h2 text-h2 font-bold text-on-surface">Payment method</h2>
            <button
              type="button"
              className="font-body-sm text-body-sm font-semibold text-accent-gold hover:underline"
              disabled
              title="Cards are managed on the secure Stripe checkout page"
            >
              Add new card
            </button>
          </div>
          <p className="rounded-xl border border-dashed border-on-surface/15 bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">
            You will confirm your payment method on the secure Stripe checkout page after clicking
            Complete purchase.
          </p>
        </section>
      </div>

      <aside className="h-fit rounded-xl border border-on-surface/10 bg-surface-container-low p-5 lg:sticky lg:top-6">
        <h2 className="font-body text-body-lg font-semibold text-on-surface">Order summary</h2>
        <div className="mt-4 space-y-2 font-body-sm text-body-sm">
          {lineItems.map((item) => (
            <div key={item.code} className="flex justify-between gap-2 text-on-surface-variant">
              <span className="min-w-0">{item.label}</span>
              <span className="shrink-0 tabular-nums font-medium text-on-surface">
                {money(item.amountCents, item.currency || currency)}
              </span>
            </div>
          ))}
          {primaryRecurring &&
          primaryRecurring.billingKind === "recurring" &&
          (primaryRecurring.setupFeeCents ?? 0) > 0 ? (
            <AddonRecurringPriceBreakdown addon={primaryRecurring} currency={currency} />
          ) : null}
          <div className="border-t border-on-surface/10 pt-3">
            <div className="flex justify-between text-on-surface-variant">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium text-on-surface">
                {money(dueTodayCents, currency)}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-on-surface-variant">
              <span>Taxes (0%)</span>
              <span className="tabular-nums">$0.00</span>
            </div>
          </div>
        </div>
        <div className="mt-4 border-t border-on-surface/10 pt-4">
          <p className="font-caption text-caption uppercase tracking-wider text-on-surface-variant">
            Due today
          </p>
          <p className="mt-1 font-h1 text-h1 font-bold tabular-nums text-accent-gold">
            {money(dueTodayCents, currency)}
          </p>
        </div>
        {hasRecurring ? (
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
        <div className="mt-4 flex flex-col gap-2">
          {onBack ? (
            <button
              type="button"
              disabled={busy || preparing}
              onClick={onBack}
              className={portal.btnSecondary + " w-full !py-2.5 !text-sm"}
            >
              Back to add-ons
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy || preparing}
            onClick={onConfirm}
            className={portal.btnPrimary + " flex w-full items-center justify-center gap-2 !py-3 !text-sm"}
          >
            <MaterialIcon name="lock" className="!text-[18px]" />
            {busy ? "Starting checkout…" : preparing ? "Preparing billing…" : "Complete purchase"}
          </button>
        </div>
        {footerNote ? (
          <p className="mt-3 text-center font-caption text-[11px] text-on-surface-variant">{footerNote}</p>
        ) : (
          <p className="mt-3 text-center font-caption text-[11px] text-on-surface-variant">
            By completing this purchase, you agree to our Terms of Service.
          </p>
        )}
      </aside>
    </div>
  );
}
