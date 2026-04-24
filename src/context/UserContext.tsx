import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getAccessToken } from "@/services/http";
import { fetchCurrentProfile, fetchSubscriptionSummary } from "@/services/accountApi";
import { syncFromStripe } from "@/services/subscriptionsApi";
import type { AccountProfile, SubscriptionSummary } from "@/types/account";

interface UserState {
  contact: AccountProfile | null;
  subscription: SubscriptionSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const UserContext = createContext<UserState | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [contact, setContact] = useState<AccountProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setContact(null);
      setSubscription(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [c, s0] = await Promise.all([fetchCurrentProfile(), fetchSubscriptionSummary()]);
      let s = s0;
      if (s == null) {
        try {
          await syncFromStripe();
        } catch {
          /* webhook-style sync is optional; profile still loads */
        }
        s = await fetchSubscriptionSummary();
      }
      setContact(c);
      setSubscription(s);
    } catch {
      setError("We could not load your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ contact, subscription, loading, error, refresh }),
    [contact, subscription, loading, error, refresh],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
