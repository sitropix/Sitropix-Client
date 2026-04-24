import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function RequireAuth({ children }: { children: ReactElement }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="text-sm text-ink-muted">Loading session...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}
