export interface AccountProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  accountName?: string;
}

export type SubscriptionState = "active" | "trialing" | "past_due" | "paused" | "canceled";

export interface SubscriptionSummary {
  planName: string;
  state: SubscriptionState;
  renewsAt?: string;
}
