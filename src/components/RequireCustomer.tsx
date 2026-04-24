import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";

/** Customer-only guard: authenticated non-admin users only. */
export function RequireCustomer({ children }: { children: ReactElement }) {
  const { isAuthenticated, loading } = useAuth();
  const { isAdmin } = useAuthz();
  if (loading) return <div className="text-sm text-ink-muted">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return children;
}

