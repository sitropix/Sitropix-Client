import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuthz } from "@/context/AuthzContext";
import { useAuth } from "@/context/AuthContext";
import { PageLoadingState } from "@/components/PageLoadingState";

/** Admin portal guard: full admins and support staff. */
export function RequireAdminPortal({ children }: { children: ReactElement }) {
  const { isAuthenticated, loading } = useAuth();
  const { canAccessAdminPortal } = useAuthz();
  if (loading) return <PageLoadingState variant="admin" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!canAccessAdminPortal) return <Navigate to="/dashboard" replace />;
  return children;
}
