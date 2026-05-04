import Stripe from "stripe";
import { env } from "../config/env.mjs";
import { log } from "../observability/logger.mjs";
import { getSystemConfigSecretValue } from "./systemConfigStore.mjs";

function fingerprintKey(key) {
  const k = String(key ?? "").trim();
  if (!k) return "<none>";
  if (k.length <= 12) return "********";
  const mode = k.startsWith("sk_live_") ? "live" : k.startsWith("sk_test_") ? "test" : "unknown";
  return `${mode}:${k.slice(0, 8)}…${k.slice(-4)}`;
}

export let stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;
log.info("stripe.client_initialized_from_env", {
  configured: Boolean(stripe),
  keyFingerprint: fingerprintKey(env.stripeSecretKey),
});

function makeStripeClient(secretKey) {
  const key = String(secretKey ?? "").trim();
  return key ? new Stripe(key) : null;
}

export async function reloadStripeFromSystemConfig() {
  const dbKey = await getSystemConfigSecretValue("STRIPE_SECRET_KEY");
  const effectiveKey = String(dbKey || env.stripeSecretKey || "").trim();
  stripe = makeStripeClient(effectiveKey);
  log.info("stripe.client_reloaded", {
    source: dbKey ? "system_config" : env.stripeSecretKey ? "env" : "none",
    configured: Boolean(stripe),
    keyFingerprint: fingerprintKey(effectiveKey),
  });
  return Boolean(stripe);
}

export function assertStripeConfigured() {
  if (!stripe) throw new Error("stripe_not_configured");
}
