import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuthz } from "@/context/AuthzContext";
import { useAuth } from "@/context/AuthContext";

export function RequireAdmin({ children }: { children: ReactElement }) {
  const { isAuthenticated, loading } = useAuth();
  const { isAdmin } = useAuthz();
  if (loading) return <div className="text-sm text-ink-muted">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}
