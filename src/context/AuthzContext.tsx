import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Role } from "@/types/subscription";
import { canAccessAdminPortal } from "@/lib/adminAccess";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/http";

interface AuthzState {
  role: Role;
  /** Full admin (not support-only). */
  isAdmin: boolean;
  isSupport: boolean;
  canAccessAdminPortal: boolean;
  isStaff: boolean;
  /** True while module-access fetch is in flight (sidebar hides nothing until known). */
  modulesLoading: boolean;
  /** Returns true when the current user can access the given admin module. Admin/master_admin always true. */
  hasModule: (moduleKey: string) => boolean;
}

const AuthzContext = createContext<AuthzState | undefined>(undefined);

interface ModuleAccessPayload {
  role: string;
  modules: string[];
  hasAllModules: boolean;
}

export function AuthzProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const role = (user?.role ?? "user") as Role;
  const isStaff = role !== "user";

  const [modulesLoading, setModulesLoading] = useState<boolean>(isStaff);
  const [enabledModules, setEnabledModules] = useState<Set<string>>(new Set());
  const [hasAllModules, setHasAllModules] = useState<boolean>(role === "admin" || role === "master_admin");

  // Refetch whenever the auth identity changes; clear when logged out.
  useEffect(() => {
    if (!isAuthenticated || !isStaff) {
      setEnabledModules(new Set());
      setHasAllModules(role === "admin" || role === "master_admin");
      setModulesLoading(false);
      return;
    }
    let cancelled = false;
    setModulesLoading(true);
    void api<ModuleAccessPayload>("/api/auth/me/module-access")
      .then((p) => {
        if (cancelled) return;
        setEnabledModules(new Set(p.modules));
        setHasAllModules(p.hasAllModules);
      })
      .catch(() => {
        if (cancelled) return;
        // Conservative on failure: assume no modules so sidebar hides things rather than promising broken nav.
        setEnabledModules(new Set());
        setHasAllModules(false);
      })
      .finally(() => {
        if (!cancelled) setModulesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isStaff, role, user?.id]);

  const value = useMemo<AuthzState>(
    () => ({
      role,
      isAdmin: role === "admin" || role === "master_admin",
      isSupport: role === "support",
      canAccessAdminPortal: canAccessAdminPortal(role),
      isStaff,
      modulesLoading,
      hasModule: (key) => hasAllModules || enabledModules.has(key),
    }),
    [role, isStaff, modulesLoading, hasAllModules, enabledModules],
  );
  return <AuthzContext.Provider value={value}>{children}</AuthzContext.Provider>;
}

export function useAuthz() {
  const ctx = useContext(AuthzContext);
  if (!ctx) throw new Error("useAuthz must be used within AuthzProvider");
  return ctx;
}
