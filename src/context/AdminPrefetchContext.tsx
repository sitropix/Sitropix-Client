import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import {
  fetchAdminAuditLogs,
  fetchAdminAuditSummary,
  fetchAdminEmailSettings,
  fetchAdminInvites,
  fetchAdminSystemConfig,
  fetchAdminPlans,
  fetchAdminSubscriptions,
  fetchAdminUserManagement,
  fetchAdminUsers,
  fetchFeatureFlagsAdmin,
  fetchAnalytics,
  fetchTransactions,
} from "@/services/subscriptionsApi";
import { fetchAdminTickets } from "@/services/supportApi";
import type { AdminSupportTicketListItem } from "@/types/support";
import type {
  AdminInviteRow,
  AuditLogListPayload,
  AuditLogSummary,
  AdminUserRow,
  AnalyticsSummary,
  EmailSettingsPayload,
  FeatureFlagsAdminPayload,
  Plan,
  Subscription,
  SystemConfigPayload,
} from "@/types/subscription";

type AdminUserManagementPayload = {
  users: Array<
    AdminUserRow & {
      status: "active" | "deactivated";
      moduleAccess?: Array<{ moduleKey: string; enabled: boolean }>;
    }
  >;
  invites: Array<{
    id: string;
    email: string;
    planId: string | null;
    createdAt: string;
    expiresAt: string;
    status: "invite_pending";
  }>;
};

interface AdminPrefetchCache {
  users: AdminUserRow[] | null;
  subscriptions: Subscription[] | null;
  plans: Plan[] | null;
  userManagement: AdminUserManagementPayload | null;
  analytics: AnalyticsSummary | null;
  transactions: Array<{ id: string; amountCents: number; status: string; invoiceNumber: string; failureReason?: string | null }> | null;
  tickets: AdminSupportTicketListItem[] | null;
  invites: AdminInviteRow[] | null;
  featureFlags: FeatureFlagsAdminPayload | null;
  emailSettings: EmailSettingsPayload | null;
  systemConfig: SystemConfigPayload | null;
  auditLogs: AuditLogListPayload | null;
  auditSummary: AuditLogSummary | null;
}

interface AdminPrefetchContextValue {
  cache: AdminPrefetchCache;
  prefetchAll: () => Promise<void>;
  updateCache: (patch: Partial<AdminPrefetchCache>) => void;
}

const AdminPrefetchContext = createContext<AdminPrefetchContextValue | undefined>(undefined);

const emptyCache: AdminPrefetchCache = {
  users: null,
  subscriptions: null,
  plans: null,
  userManagement: null,
  analytics: null,
  transactions: null,
  tickets: null,
  invites: null,
  featureFlags: null,
  emailSettings: null,
  systemConfig: null,
  auditLogs: null,
  auditSummary: null,
};

export function AdminPrefetchProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { isAdmin, isSupport } = useAuthz();
  const [cache, setCache] = useState<AdminPrefetchCache>(emptyCache);
  const prefetchedRef = useRef(false);

  const updateCache = useCallback((patch: Partial<AdminPrefetchCache>) => {
    setCache((prev) => ({ ...prev, ...patch }));
  }, []);

  const prefetchSupportTickets = useCallback(async () => {
    if (!isAuthenticated || !isSupport) return;
    const result = await fetchAdminTickets({ limit: 100, categoryScope: "general" });
    setCache((prev) => ({ ...prev, tickets: result.items }));
  }, [isAuthenticated, isSupport]);

  const prefetchAll = useCallback(async () => {
    if (!isAuthenticated || !isAdmin) return;
    const results = await Promise.allSettled([
      fetchAdminUsers(),
      fetchAdminSubscriptions(),
      fetchAdminPlans(),
      fetchAdminUserManagement(),
      fetchAnalytics(),
      fetchTransactions(),
      fetchAdminTickets({ limit: 100, categoryScope: "general" }),
      fetchAdminInvites(),
      fetchFeatureFlagsAdmin(),
      fetchAdminEmailSettings(),
      fetchAdminSystemConfig(),
      fetchAdminAuditLogs({ limit: 50, page: 1 }),
      fetchAdminAuditSummary(),
    ]);

    setCache((prev) => ({
      ...prev,
      users: results[0].status === "fulfilled" ? results[0].value : prev.users,
      subscriptions: results[1].status === "fulfilled" ? results[1].value : prev.subscriptions,
      plans: results[2].status === "fulfilled" ? results[2].value : prev.plans,
      userManagement: results[3].status === "fulfilled" ? results[3].value : prev.userManagement,
      analytics: results[4].status === "fulfilled" ? results[4].value : prev.analytics,
      transactions: results[5].status === "fulfilled" ? results[5].value : prev.transactions,
      tickets: results[6].status === "fulfilled" ? results[6].value.items : prev.tickets,
      invites: results[7].status === "fulfilled" ? results[7].value : prev.invites,
      featureFlags: results[8].status === "fulfilled" ? results[8].value : prev.featureFlags,
      emailSettings: results[9].status === "fulfilled" ? results[9].value : prev.emailSettings,
      systemConfig: results[10].status === "fulfilled" ? results[10].value : prev.systemConfig,
      auditLogs: results[11].status === "fulfilled" ? results[11].value : prev.auditLogs,
      auditSummary: results[12].status === "fulfilled" ? results[12].value : prev.auditSummary,
    }));
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    if (!isAuthenticated || (!isAdmin && !isSupport)) {
      prefetchedRef.current = false;
      setCache(emptyCache);
      return;
    }
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    if (isSupport) {
      void prefetchSupportTickets();
      return;
    }
    void prefetchAll();
  }, [isAuthenticated, isAdmin, isSupport, prefetchAll, prefetchSupportTickets]);

  const value = useMemo(() => ({ cache, prefetchAll, updateCache }), [cache, prefetchAll, updateCache]);
  return <AdminPrefetchContext.Provider value={value}>{children}</AdminPrefetchContext.Provider>;
}

export function useAdminPrefetch() {
  const ctx = useContext(AdminPrefetchContext);
  if (!ctx) throw new Error("useAdminPrefetch must be used within AdminPrefetchProvider");
  return ctx;
}
