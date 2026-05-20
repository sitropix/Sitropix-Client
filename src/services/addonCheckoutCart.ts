import {
  EXTRA_EDIT_BUNDLE_CODE,
  EXTRA_EDIT_SINGLE_CODE,
} from "@/constants/extraEditAddons";
import {
  addonCardDisplayCents,
  addonRecurringMonthlyCents,
  isRecurringSetupAddon,
} from "@/lib/addonDisplayHelpers";
import type { ProjectRecord } from "@/types/project";
import type { Plan, SubscriptionAddon } from "@/types/subscription";

const STORAGE_KEY = "sitropix_addon_checkout_cart_v1";

export type ExtraEditCheckoutIntent = {
  mode: "per_edit" | "bundle";
  perEditQuantity?: number;
};

export type AddonCheckoutLineItem = {
  code: string;
  label: string;
  description: string;
  amountCents: number;
  currency: string;
  billingKind?: SubscriptionAddon["billingKind"];
  setupFeeCents?: number;
  priceCents?: number;
  isRecurring?: boolean;
};

export type AddonCheckoutCart = {
  version: 1;
  projectId: string;
  addonCodes: string[];
  lineItems: AddonCheckoutLineItem[];
  dueTodayCents: number;
  currency: string;
  returnUrl: string;
  extraEditCheckout?: ExtraEditCheckoutIntent;
  addonRecurringCycle?: "monthly" | "yearly";
};

function lineItemsFromAddon(
  addon: SubscriptionAddon,
  plans: Plan[],
  projectPlanId: string | null | undefined,
): AddonCheckoutLineItem[] {
  const currency = addon.currency || "USD";
  const isRecurring = addon.billingKind === "recurring";

  if (isRecurringSetupAddon(addon)) {
    const setup = addon.setupFeeCents ?? 0;
    const recurring = addon.priceCents ?? 0;
    const items: AddonCheckoutLineItem[] = [];
    if (setup > 0) {
      items.push({
        code: addon.code,
        label: `${addon.label} Setup (One-time fee)`,
        description: addon.desc,
        amountCents: setup,
        currency,
        billingKind: addon.billingKind,
        setupFeeCents: setup,
        priceCents: recurring,
        isRecurring: true,
      });
    }
    if (recurring > 0) {
      items.push({
        code: `${addon.code}_recurring`,
        label: `${addon.label} Recurring (Prorated)`,
        description: addon.desc,
        amountCents: recurring,
        currency,
        billingKind: addon.billingKind,
        setupFeeCents: setup,
        priceCents: recurring,
        isRecurring: true,
      });
    }
    if (items.length > 0) return items;
  }

  const plainRecurring =
    isRecurring && !isRecurringSetupAddon(addon) ? addonRecurringMonthlyCents(addon) : null;

  return [
    {
      code: addon.code,
      label: addon.label,
      description: addon.desc,
      amountCents: plainRecurring ?? addonCardDisplayCents(addon, plans, projectPlanId),
      currency,
      billingKind: addon.billingKind,
      setupFeeCents: addon.setupFeeCents,
      priceCents: addon.priceCents,
      isRecurring,
    },
  ];
}

export function buildAddonCheckoutCartFromAddons(opts: {
  project: ProjectRecord;
  addons: SubscriptionAddon[];
  plans: Plan[];
  returnUrl: string;
}): AddonCheckoutCart {
  const { project, addons, plans, returnUrl } = opts;
  const lineItems = addons.flatMap((a) => lineItemsFromAddon(a, plans, project.planId));
  const dueTodayCents = addons.reduce(
    (sum, a) => sum + addonCardDisplayCents(a, plans, project.planId),
    0,
  );
  return {
    version: 1,
    projectId: project.id,
    addonCodes: addons.map((a) => a.code),
    lineItems,
    dueTodayCents,
    currency: addons[0]?.currency || "USD",
    returnUrl,
  };
}

export function buildExtraEditCheckoutCart(opts: {
  projectId: string;
  mode: "per_edit" | "bundle";
  quantity: number;
  perEditCents: number;
  bundleCredits: number;
  bundleCents: number;
  currency: string;
  singleAddon?: SubscriptionAddon | null;
  bundleAddon?: SubscriptionAddon | null;
  companionAddonCodes?: string[];
  returnUrl: string;
}): AddonCheckoutCart {
  const companion = (opts.companionAddonCodes ?? []).filter(Boolean);
  const singleCode = opts.singleAddon?.code ?? EXTRA_EDIT_SINGLE_CODE;
  const bundleCode = opts.bundleAddon?.code ?? EXTRA_EDIT_BUNDLE_CODE;

  if (opts.mode === "per_edit") {
    const qty = Math.max(1, opts.quantity);
    const amountCents = opts.perEditCents * qty;
    const codes = Array.from(new Set([...companion, singleCode]));
    return {
      version: 1,
      projectId: opts.projectId,
      addonCodes: codes,
      lineItems: [
        {
          code: singleCode,
          label: opts.singleAddon?.label ?? "Website edit credits",
          description: `${qty} edit credit${qty === 1 ? "" : "s"} at ${formatCents(opts.perEditCents, opts.currency)} each`,
          amountCents,
          currency: opts.currency,
          billingKind: opts.singleAddon?.billingKind ?? "one_time",
        },
      ],
      dueTodayCents: amountCents,
      currency: opts.currency,
      returnUrl: opts.returnUrl,
      extraEditCheckout: { mode: "per_edit", perEditQuantity: qty },
    };
  }

  const codes = Array.from(new Set([...companion, bundleCode]));
  return {
    version: 1,
    projectId: opts.projectId,
    addonCodes: codes,
    lineItems: [
      {
        code: bundleCode,
        label: opts.bundleAddon?.label ?? `${opts.bundleCredits} Credit Bundle`,
        description:
          opts.bundleAddon?.desc ??
          `${opts.bundleCredits} website edit credits for this billing cycle`,
        amountCents: opts.bundleCents,
        currency: opts.currency,
        billingKind: opts.bundleAddon?.billingKind ?? "one_time",
      },
    ],
    dueTodayCents: opts.bundleCents,
    currency: opts.currency,
    returnUrl: opts.returnUrl,
    extraEditCheckout: { mode: "bundle" },
  };
}

function formatCents(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

export function saveAddonCheckoutCart(cart: AddonCheckoutCart) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

export function readAddonCheckoutCart(projectId: string): AddonCheckoutCart | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AddonCheckoutCart;
    if (parsed?.version !== 1 || parsed.projectId !== projectId) return null;
    if (!Array.isArray(parsed.addonCodes) || parsed.addonCodes.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAddonCheckoutCart() {
  sessionStorage.removeItem(STORAGE_KEY);
}
