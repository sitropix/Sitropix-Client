import { portal } from "@/components/portal/portalStyles";
import {
  addonFulfillmentBadgeClass,
  addonFulfillmentStatusLabel,
} from "@/lib/addonUtilizationDisplay";
import type { ProjectAddonFulfillment } from "@/types/project";
import type { BillingCycle } from "@/types/subscription";
import type { SubscriptionAddon } from "@/types/subscription";
import type { ReactNode } from "react";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function AddonRecurringPriceBreakdown({
  addon,
  currency,
  billingCycle = "monthly",
  recurringCents,
}: {
  addon: SubscriptionAddon;
  currency: string;
  billingCycle?: BillingCycle;
  recurringCents?: number;
}) {
  const setup = addon.setupFeeCents ?? 0;
  if (addon.billingKind !== "recurring" || setup <= 0) return null;
  const rec = recurringCents ?? addon.priceCents ?? 0;
  const cycleLabel = billingCycle === "yearly" ? "per year" : "per month";
  return (
    <div className="mt-3 space-y-1.5 rounded-lg border border-on-surface/8 bg-surface-container-low px-3 py-2.5 text-[11px]">
      <div className="flex justify-between gap-2 text-on-surface-variant">
        <span>Setup (one-time)</span>
        <span className="tabular-nums font-semibold text-on-surface">{money(setup, currency)}</span>
      </div>
      <div className="flex justify-between gap-2 text-on-surface-variant">
        <span>Recurring ({cycleLabel})</span>
        <span className="tabular-nums font-semibold text-on-surface">{money(rec, currency)}</span>
      </div>
      <p className="border-t border-on-surface/8 pt-1.5 text-[10px] leading-snug text-on-surface-variant">
        First checkout charges setup plus the first billing cycle; renewals bill the recurring amount only.
      </p>
    </div>
  );
}

export function AddonBillingCycleToggle({
  value,
  onChange,
  disabled = false,
  className = "",
}: {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex rounded-full border border-on-surface/10 bg-surface-container-low p-1 ${className}`}
      role="group"
      aria-label="Add-on billing cycle"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("monthly")}
        className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
          value === "monthly"
            ? "bg-on-surface text-surface"
            : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("yearly")}
        className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
          value === "yearly"
            ? "bg-on-surface text-surface"
            : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        Yearly
      </button>
    </div>
  );
}

function StatusBadge({
  children,
  variant,
}: {
  children: ReactNode;
  variant: "active" | "recurring" | "popular";
}) {
  const cls =
    variant === "active"
      ? "bg-emerald-500/15 text-emerald-700"
      : variant === "popular"
        ? "bg-accent-gold text-white"
        : "bg-surface-container text-on-surface-variant";
  return (
    <span
      className={`shrink-0 rounded px-2 py-0.5 font-caption text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {children}
    </span>
  );
}

export type AddonOfferCardProps = {
  label: string;
  description: string;
  priceLabel: string;
  priceSuffix?: string | null;
  caption?: string | null;
  breakdown?: ReactNode;
  mode: "purchase" | "select" | "owned" | "active" | "upgrade";
  selected?: boolean;
  disabled?: boolean;
  popular?: boolean;
  categoryTag?: string;
  actionLabel?: string;
  ownedLabel?: string;
  fulfillment?: ProjectAddonFulfillment | null;
  fulfillmentAction?: ReactNode;
  onPress?: () => void;
  onManage?: () => void;
};

export function AddonOfferCard({
  label,
  description,
  priceLabel,
  priceSuffix,
  caption,
  breakdown,
  mode,
  selected = false,
  disabled = false,
  popular = false,
  categoryTag,
  actionLabel = "Purchase add-on",
  ownedLabel = "On your plan",
  fulfillment = null,
  fulfillmentAction = null,
  onPress,
  onManage,
}: AddonOfferCardProps) {
  if (mode === "active") {
    return (
      <article className={portal.addonPageCard}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-body text-body-lg font-semibold text-on-surface">{label}</h3>
          <StatusBadge variant="active">Active</StatusBadge>
        </div>
        {categoryTag ? (
          <p className="mt-2 font-caption text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
            {categoryTag}
          </p>
        ) : null}
        <p className="mt-2 flex-1 font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
          {description}
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onManage}
            className="font-body text-sm font-semibold text-on-surface underline-offset-2 hover:underline"
          >
            Manage
          </button>
        </div>
      </article>
    );
  }

  if (mode === "upgrade") {
    const cardCls = popular ? portal.addonPageCardPopular : portal.addonPageCard;
    return (
      <article className={cardCls}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="pr-2 font-body text-body-lg font-semibold text-on-surface">{label}</h3>
          {popular ? (
            <StatusBadge variant="popular">Most popular</StatusBadge>
          ) : (
            <StatusBadge variant="recurring">Recurring</StatusBadge>
          )}
        </div>
        <p className="mt-3 font-h2 text-h2 font-bold tabular-nums text-on-surface">
          {priceLabel}
          {priceSuffix ? (
            <span className="ml-1 font-body text-sm font-normal text-on-surface-variant">
              {priceSuffix}
            </span>
          ) : null}
        </p>
        <p className="mt-2 flex-1 font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
          {description}
        </p>
        {caption ? (
          <p className="mt-1 font-caption text-caption text-on-surface-variant">{caption}</p>
        ) : null}
        {breakdown}
        <button
          type="button"
          disabled={disabled}
          onClick={onPress}
          className={portal.btnPrimary + " mt-5 w-full !py-2.5 !text-sm"}
        >
          {actionLabel}
        </button>
      </article>
    );
  }

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-body text-body-lg font-semibold text-on-surface">{label}</p>
        <span className={portal.addonPriceBadge}>
          {priceLabel}
          {priceSuffix ? (
            <span className="ml-0.5 font-normal text-on-surface-variant">{priceSuffix}</span>
          ) : null}
        </span>
      </div>
      <p className="mt-2 flex-1 font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
        {description}
      </p>
      {caption ? (
        <p className="mt-1 font-caption text-caption font-medium text-on-surface-variant">{caption}</p>
      ) : null}
      {breakdown}
    </>
  );

  if (mode === "owned") {
    if (!fulfillment?.tracksFulfillment) {
      return (
        <div className={portal.addonCardMuted} aria-disabled>
          {body}
          <span
            className={
              portal.btnSecondary +
              " mt-4 w-full !cursor-default !py-2.5 !text-sm opacity-70"
            }
          >
            {ownedLabel}
          </span>
        </div>
      );
    }

    return (
      <div className={portal.addonCardMuted} aria-disabled>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 font-body text-body-lg font-semibold text-on-surface">{label}</p>
          <span
            className={`shrink-0 rounded px-2 py-0.5 font-caption text-[10px] font-bold uppercase tracking-wider ${addonFulfillmentBadgeClass(fulfillment.status)}`}
          >
            {addonFulfillmentStatusLabel(fulfillment.status)}
          </span>
        </div>
        <p className="mt-2 font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
          {description}
        </p>
        {caption ? (
          <p className="mt-1 font-caption text-caption font-medium text-on-surface-variant">{caption}</p>
        ) : null}
        {breakdown}
        {fulfillmentAction ? <div className="mt-3">{fulfillmentAction}</div> : null}
        <span
          className={
            portal.btnSecondary +
            " mt-4 w-full !cursor-default !py-2.5 !text-sm opacity-70"
          }
        >
          {ownedLabel}
        </span>
      </div>
    );
  }

  if (mode === "select") {
    return (
      <article
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) onPress?.();
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPress?.();
          }
        }}
        className={`${selected ? "border-2 border-accent-gold ring-1 ring-accent-gold/20" : "border border-on-surface/10"} flex h-full cursor-pointer flex-col rounded-lg bg-surface-container-lowest p-5 shadow-sm transition hover:border-accent-gold/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/35 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <path d="M3.3 7.7L12 12l8.7-4.3M12 22V12" />
          </svg>
        </div>
        <h3 className="font-body text-body-lg font-semibold text-on-surface">{label}</h3>
        <p className="mt-2 font-h2 text-h2 font-bold tabular-nums text-on-surface">{priceLabel}</p>
        <p className="mt-2 flex-1 font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
          {description}
        </p>
        {caption ? (
          <p className="mt-1 font-caption text-caption text-on-surface-variant">{caption}</p>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onPress?.();
          }}
          className={selected ? portal.addonSelectBtnActive : portal.addonSelectBtn}
        >
          {selected ? "✓ Selected" : "Select"}
        </button>
      </article>
    );
  }

  return (
    <article className={portal.addonCard}>
      {body}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onPress?.();
        }}
        className={
          portal.btnPrimary +
          " mt-4 w-full !py-2.5 !text-sm disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        {actionLabel}
      </button>
    </article>
  );
}
