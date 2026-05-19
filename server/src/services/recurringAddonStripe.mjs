/** Stripe metadata.kind for add-on-only subscriptions (interval differs from the project plan). */
export const STRIPE_RECURRING_ADDON_SUB_KIND = "project_recurring_addon";

/**
 * Stripe Checkout (subscription mode) line items for add-ons.
 * Recurring add-on with a setup fee: first invoice includes setup (one-time line) + recurring unit;
 * renewals charge only the recurring portion.
 */
export function addonStripeRecurringInterval(addonRow, planBillingCycle) {
  const j = addonRow?.catalogJson && typeof addonRow.catalogJson === "object" ? addonRow.catalogJson : {};
  const ival = j.stripeRecurringInterval ?? j.stripe_recurring_interval;
  if (ival === "month" || ival === "year") return ival;
  return planBillingCycle === "yearly" ? "year" : "month";
}

export function buildSubscriptionCheckoutAddonLineItems(planCurrency, planBillingCycle, addonRow) {
  const currency = String(planCurrency ?? "usd").toLowerCase();
  const interval = addonStripeRecurringInterval(addonRow, planBillingCycle);
  const setup = Math.max(0, addonRow.setupFeeCents ?? 0);
  const recurring = Math.max(0, addonRow.priceCents ?? 0);

  if (addonRow.billingKind === "recurring" && setup > 0) {
    return [
      {
        price_data: {
          currency,
          product_data: { name: `${addonRow.label} — setup (first invoice only)` },
          unit_amount: setup,
        },
        quantity: 1,
      },
      {
        price_data: {
          currency,
          product_data: { name: addonRow.label },
          recurring: { interval },
          unit_amount: recurring,
        },
        quantity: 1,
      },
    ];
  }

  return [
    {
      price_data: {
        currency,
        product_data: { name: addonRow.label },
        recurring: { interval },
        unit_amount: recurring,
      },
      quantity: 1,
    },
  ];
}

/**
 * Subscription items require a Price id — inline `price_data.product_data` is not supported on
 * `subscriptionItems.create` (unlike Checkout Sessions). Create a Price, then attach by id.
 */
export async function createStripeRecurringPriceForAddon(
  stripeClient,
  { currency, unitAmountCents, interval, label, addonCode },
) {
  return stripeClient.prices.create({
    currency: String(currency ?? "usd").toLowerCase(),
    unit_amount: Math.max(0, Math.floor(unitAmountCents)),
    recurring: { interval: interval === "year" ? "year" : "month" },
    product_data: { name: String(label ?? "Add-on").slice(0, 250) },
    metadata: addonCode ? { sitropixAddonCode: String(addonCode) } : undefined,
  });
}

/**
 * Dedicated Stripe subscription when add-on interval ≠ plan interval (e.g. monthly add-on on yearly plan).
 * First period is collected in Checkout; `trial_end` defers the first Stripe renewal invoice.
 */
export async function createSeparateRecurringAddonSubscription(
  stripeClient,
  {
    customerId,
    currency,
    unitAmountCents,
    interval,
    label,
    addonCode,
    projectId,
    userId,
    trialEndUnix,
  },
) {
  const price = await createStripeRecurringPriceForAddon(stripeClient, {
    currency,
    unitAmountCents,
    interval,
    label,
    addonCode,
  });
  return stripeClient.subscriptions.create({
    customer: customerId,
    items: [
      {
        price: price.id,
        metadata: { sitropixAddon: String(addonCode) },
      },
    ],
    metadata: {
      sitropixKind: STRIPE_RECURRING_ADDON_SUB_KIND,
      sitropixProjectId: String(projectId),
      sitropixAddon: String(addonCode),
      userId: String(userId),
    },
    trial_end: trialEndUnix,
    proration_behavior: "none",
  });
}
