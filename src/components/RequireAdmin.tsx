import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuthz } from "@/context/AuthzContext";
import { useAuth } from "@/context/AuthContext";
import { PageLoadingState } from "@/components/PageLoadingState";

/** Full admin only (excludes support-only staff). */
export function RequireAdmin({ children }: { children: ReactElement }) {
  const { isAuthenticated, loading } = useAuth();
  const { isAdmin, isSupport } = useAuthz();
  if (loading) return <PageLoadingState variant="admin" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isSupport) return <Navigate to="/admin/tickets" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}
