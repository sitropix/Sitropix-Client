import { useCallback, useEffect, useState } from "react";
import { fetchCustomerPortal } from "@/services/subscriptionsApi";
import type { CustomerPortalPayload } from "@/types/subscription";

export function useSubscriptionPortal() {
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

  return { data, loading, error, refresh };
}
