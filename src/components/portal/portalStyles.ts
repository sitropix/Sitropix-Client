/** Shared Tailwind class strings for client portal pages (Figma home UX). */
export const portal = {
  page: "space-y-8",
  hero: "relative overflow-hidden rounded-lg border ink-border-8 bg-surface-container-low p-8 soft-shadow-xl sm:p-10",
  heroEyebrow: "font-caption text-caption uppercase tracking-wider text-on-surface-variant",
  heroTitle: "mt-2 font-h2 text-h2 text-on-surface",
  heroSubtitle: "mt-2 max-w-2xl font-body text-body text-on-surface-variant",
  card: "overflow-hidden rounded-lg border ink-border-8 bg-surface-container-lowest soft-shadow-xl",
  cardHeader: "border-b ink-border-10 bg-surface-container-low px-5 py-4 sm:px-6",
  cardHeaderTitle: "font-body font-semibold text-on-surface",
  cardHeaderSubtitle: "mt-1 font-body-sm text-body-sm text-on-surface-variant",
  cardBody: "p-4 sm:p-5",
  panel: "rounded-lg border ink-border-8 bg-surface-container-lowest p-6 soft-shadow-xl",
  btnPrimary:
    "portal-btn-primary inline-flex items-center justify-center rounded-lg bg-accent-gold px-5 py-2.5 font-body font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50",
  btnSecondary:
    "portal-btn-secondary inline-flex items-center justify-center rounded-lg border ink-border-15 bg-surface-container-lowest px-5 py-2.5 font-body font-semibold text-on-surface transition-all hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50",
  btnDark:
    "portal-btn-dark inline-flex items-center justify-center rounded-lg bg-on-surface px-5 py-2.5 font-body font-medium text-surface transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
  input:
    "w-full rounded-lg border border-on-surface/10 bg-surface-container-low px-3 py-2 font-body-sm text-on-surface outline-none transition focus:border-accent-gold disabled:cursor-not-allowed disabled:opacity-50",
  pageTitle: "font-h2 text-h2 text-on-surface",
  pageSubtitle: "mt-2 max-w-xl font-body text-body text-on-surface-variant",
  addonSectionEyebrow:
    "font-caption text-caption font-semibold uppercase tracking-[0.12em] text-on-surface-variant",
  addonCard:
    "flex h-full w-full flex-col rounded-lg border border-on-surface/10 bg-surface-container-lowest p-4 text-left shadow-sm transition hover:border-accent-gold/25 hover:shadow-md",
  addonCardMuted:
    "flex h-full w-full flex-col rounded-lg border border-on-surface/10 bg-surface-container-low p-4 text-left opacity-90",
  addonCardSelected:
    "w-full rounded-lg border-2 border-accent-gold/40 bg-gold-light/20 px-4 py-3 text-left ring-1 ring-accent-gold/15 transition",
  addonPriceBadge:
    "shrink-0 rounded-full bg-gold-light px-2.5 py-0.5 font-caption text-caption font-bold text-on-secondary-container",
  addonPageCard:
    "relative flex h-full flex-col rounded-lg border border-on-surface/10 bg-surface-container-lowest p-5 shadow-sm transition hover:border-accent-gold/20 hover:shadow-md",
  addonPageCardPopular:
    "relative flex h-full flex-col rounded-lg border border-t-4 border-t-accent-gold border-on-surface/10 bg-surface-container-lowest p-5 pt-4 shadow-sm",
  addonSelectBtn:
    "mt-auto w-full rounded-lg bg-on-surface py-2.5 text-center font-body text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
  addonSelectBtnActive:
    "mt-auto w-full rounded-lg bg-accent-gold py-2.5 text-center font-body text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50",
  addonCheckoutBar:
    "fixed bottom-6 left-1/2 z-40 flex w-[min(100%,42rem)] -translate-x-1/2 items-center justify-between gap-4 rounded-2xl border border-on-surface/10 bg-surface-container-lowest px-5 py-4 shadow-2xl",
} as const;
