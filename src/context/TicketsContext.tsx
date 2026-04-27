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
import { createTicket, fetchTickets } from "@/services/supportApi";
import type { CreateTicketInput, SupportTicket } from "@/types/support";

interface TicketsState {
  tickets: SupportTicket[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  submitTicket: (input: CreateTicketInput) => Promise<SupportTicket>;
}

const TicketsContext = createContext<TicketsState | undefined>(undefined);

function normalizeTickets(payload: unknown): SupportTicket[] {
  if (Array.isArray(payload)) return payload as SupportTicket[];
  return [];
}

export function TicketsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setTickets([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTickets();
      setTickets(normalizeTickets(data));
    } catch {
      setError("Unable to load tickets.");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setTickets([]);
      setError(null);
      setLoading(false);
      return;
    }
    void reload();
  }, [authLoading, isAuthenticated, reload]);

  const submitTicket = useCallback(async (input: CreateTicketInput) => {
    const created = await createTicket(input);
    setTickets((prev) => [created, ...prev]);
    return created;
  }, []);

  const value = useMemo(
    () => ({ tickets, loading, error, reload, submitTicket }),
    [tickets, loading, error, reload, submitTicket],
  );

  return <TicketsContext.Provider value={value}>{children}</TicketsContext.Provider>;
}

export function useTicketsContext() {
  const ctx = useContext(TicketsContext);
  if (!ctx) throw new Error("useTicketsContext must be used within TicketsProvider");
  return ctx;
}
