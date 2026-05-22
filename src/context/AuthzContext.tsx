import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Role } from "@/types/subscription";
import { canAccessAdminPortal } from "@/lib/adminAccess";
import { useAuth } from "@/context/AuthContext";

interface AuthzState {
  role: Role;
  /** Full admin (not support-only). */
  isAdmin: boolean;
  isSupport: boolean;
  canAccessAdminPortal: boolean;
  isStaff: boolean;
}

const AuthzContext = createContext<AuthzState | undefined>(undefined);

export function AuthzProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const role = (user?.role ?? "user") as Role;
  const value = useMemo(
    () => ({
      role,
      isAdmin: role === "admin" || role === "master_admin",
      isSupport: role === "support",
      canAccessAdminPortal: canAccessAdminPortal(role),
      isStaff: role !== "user",
    }),
    [role],
  );
  return <AuthzContext.Provider value={value}>{children}</AuthzContext.Provider>;
}

export function useAuthz() {
  const ctx = useContext(AuthzContext);
  if (!ctx) throw new Error("useAuthz must be used within AuthzProvider");
  return ctx;
}
