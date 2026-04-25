import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchCustomerPortal } from "@/services/subscriptionsApi";
import type { CustomerPortalPayload } from "@/types/subscription";

interface SubscriptionPortalState {
  data: CustomerPortalPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const SubscriptionPortalContext = createContext<SubscriptionPortalState | undefined>(undefined);

export function SubscriptionPortalProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CustomerPortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCustomerPortal());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subscription portal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ data, loading, error, refresh }), [data, loading, error, refresh]);

  return <SubscriptionPortalContext.Provider value={value}>{children}</SubscriptionPortalContext.Provider>;
}

export function useSubscriptionPortal() {
  const ctx = useContext(SubscriptionPortalContext);
  if (!ctx) throw new Error("useSubscriptionPortal must be used within SubscriptionPortalProvider");
  return ctx;
}
