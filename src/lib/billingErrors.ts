import { ApiRequestError } from "@/services/http";

/** Readable copy for subscription / add-on / billing portal API failures. */
export function formatBillingApiError(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (err instanceof ApiRequestError) {
    switch (err.code) {
      case "missing_stripe_customer":
        return "We could not link your billing profile. Refresh the page and try again.";
      case "subscription_not_active":
        return "Activate a subscription for this project before purchasing add-ons.";
      case "stripe_not_configured":
      case "stripe_customer_create_failed":
        return "Payments are temporarily unavailable. Please try again later or contact support.";
      default:
        break;
    }
    const raw = err.message.trim();
    if (raw && err.status < 500 && !raw.includes("request_failed")) return raw;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}
