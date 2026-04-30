import Stripe from "stripe";
import { env } from "../config/env.mjs";
import { getSystemConfigSecretValue } from "./systemConfigStore.mjs";

export let stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;

function makeStripeClient(secretKey) {
  const key = String(secretKey ?? "").trim();
  return key ? new Stripe(key) : null;
}

export async function reloadStripeFromSystemConfig() {
  const dbKey = await getSystemConfigSecretValue("STRIPE_SECRET_KEY");
  const effectiveKey = String(dbKey || env.stripeSecretKey || "").trim();
  stripe = makeStripeClient(effectiveKey);
  return Boolean(stripe);
}

export function assertStripeConfigured() {
  if (!stripe) throw new Error("stripe_not_configured");
}
