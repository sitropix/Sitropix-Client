import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { adminHomePath } from "@/lib/adminAccess";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import { PageLoadingState } from "@/components/PageLoadingState";

/** Customer-only guard: authenticated non-admin users only. */
export function RequireCustomer({ children }: { children: ReactElement }) {
  const { isAuthenticated, loading } = useAuth();
  const { role, canAccessAdminPortal } = useAuthz();
  if (loading) return <PageLoadingState variant="dashboard" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (canAccessAdminPortal) return <Navigate to={adminHomePath(role)} replace />;
  return children;
}

