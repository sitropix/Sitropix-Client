import Stripe from "stripe";
import { env } from "../config/env.mjs";

export const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;

export function assertStripeConfigured() {
  if (!stripe) throw new Error("stripe_not_configured");
}
