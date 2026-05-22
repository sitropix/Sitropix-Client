import { Navigate } from "react-router-dom";
import { Hero } from "@/components/Hero";
import { adminHomePath } from "@/lib/adminAccess";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";

export function HomePage() {
  const { isAuthenticated, loading } = useAuth();
  const { role, canAccessAdminPortal } = useAuthz();
  if (loading) return <div className="text-sm text-ink-muted">Loading session...</div>;
  if (isAuthenticated) {
    return (
      <Navigate
        to={canAccessAdminPortal ? adminHomePath(role) : "/subscription-management"}
        replace
      />
    );
  }

  return (
    <div className="opacity-0 animate-fade-up [animation-fill-mode:forwards]">
      <Hero />
    </div>
  );
}
