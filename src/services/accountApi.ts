import type { CustomerPortalPayload } from "@/types/subscription";
import type { AccountProfile, SubscriptionSummary } from "@/types/account";

export function profileAndSubscriptionFromPortal(portal: CustomerPortalPayload): {
  contact: AccountProfile;
  subscription: SubscriptionSummary | null;
} {
  const [firstName, ...rest] = portal.user.name.split(" ");
  const contact: AccountProfile = {
    id: portal.user.id,
    firstName: firstName || "Customer",
    lastName: rest.join(" "),
    email: portal.user.email,
    phoneNumber: portal.user.phoneNumber ?? null,
    accountName: "Sitropix Workspace",
  };
  const subscription: SubscriptionSummary | null = portal.subscription
    ? {
        planName: portal.subscription.plan?.name ?? "Custom",
        state: portal.subscription.status,
        renewsAt: portal.subscription.nextBillingDate,
        planId: portal.subscription.planId,
      }
    : null;
  return { contact, subscription };
}
