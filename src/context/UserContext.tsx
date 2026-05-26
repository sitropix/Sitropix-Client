import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import { getAccessToken } from "@/services/http";
import { profileAndSubscriptionFromPortal } from "@/services/accountApi";
import { fetchCustomerPortal, syncFromStripe } from "@/services/subscriptionsApi";
import type { CustomerPortalPayload } from "@/types/subscription";
import type { AccountProfile, SubscriptionSummary } from "@/types/account";

interface UserState {
  contact: AccountProfile | null;
  subscription: SubscriptionSummary | null;
  portal: CustomerPortalPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const UserContext = createContext<UserState | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { canAccessAdminPortal } = useAuthz();
  const [contact, setContact] = useState<AccountProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [portal, setPortal] = useState<CustomerPortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!getAccessToken() || !isAuthenticated || canAccessAdminPortal) {
      setContact(null);
      setSubscription(null);
      setPortal(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let portalPayload = await fetchCustomerPortal();
      const { contact: c, subscription: s0 } = profileAndSubscriptionFromPortal(portalPayload);
      let s = s0;
      if (s == null) {
        try {
          await syncFromStripe();
        } catch {
          /* optional */
        }
        portalPayload = await fetchCustomerPortal();
        const parsed = profileAndSubscriptionFromPortal(portalPayload);
        c = parsed.contact;
        s = parsed.subscription;
      }
      setPortal(portalPayload);
      setContact(c);
      setSubscription(s);
    } catch {
      setError("We could not load your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, canAccessAdminPortal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ contact, subscription, portal, loading, error, refresh }),
    [contact, subscription, portal, loading, error, refresh],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
