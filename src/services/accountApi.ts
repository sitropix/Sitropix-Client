import { fetchCustomerPortal } from "@/services/subscriptionsApi";
import type { AccountProfile, SubscriptionSummary } from "@/types/account";

export async function fetchCurrentProfile(): Promise<AccountProfile> {
  const portal = await fetchCustomerPortal();
  const [firstName, ...rest] = portal.user.name.split(" ");
  return {
    id: portal.user.id,
    firstName: firstName || "Customer",
    lastName: rest.join(" "),
    email: portal.user.email,
    accountName: "Sitropix Workspace",
  };
}

export async function fetchSubscriptionSummary(): Promise<SubscriptionSummary | null> {
  const portal = await fetchCustomerPortal();
  if (!portal.subscription) return null;
  return {
    planName: portal.subscription.plan?.name ?? "Custom",
    state: portal.subscription.status,
    renewsAt: portal.subscription.nextBillingDate,
  };
}
