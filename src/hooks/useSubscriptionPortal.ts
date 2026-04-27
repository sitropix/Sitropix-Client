import { useUser } from "@/context/UserContext";
import type { CustomerPortalPayload } from "@/types/subscription";

/** Billing / portal payload (shared with `useUser` — single `/api/subscriptions/portal` fetch). */
export function useSubscriptionPortal(): {
  data: CustomerPortalPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { portal, loading, error, refresh } = useUser();
  return { data: portal, loading, error, refresh };
}
