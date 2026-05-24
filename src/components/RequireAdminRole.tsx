import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuthz } from "@/context/AuthzContext";
import { useAuth } from "@/context/AuthContext";
import { PageLoadingState } from "@/components/PageLoadingState";

export function RequireAdminRole({ children }: { children: ReactElement }) {
  const { isAuthenticated, loading } = useAuth();
  const { isAdmin } = useAuthz();
  if (loading) return <PageLoadingState variant="admin" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/admin" replace />;
  return children;
}
