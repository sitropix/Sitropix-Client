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
