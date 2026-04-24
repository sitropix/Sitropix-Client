import { Navigate } from "react-router-dom";
import { Hero } from "@/components/Hero";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";

export function HomePage() {
  const { isAuthenticated, loading } = useAuth();
  const { isAdmin } = useAuthz();
  if (loading) return <div className="text-sm text-ink-muted">Loading session...</div>;
  if (isAuthenticated) return <Navigate to={isAdmin ? "/admin" : "/subscription-management"} replace />;

  return (
    <div className="opacity-0 animate-fade-up [animation-fill-mode:forwards]">
      <Hero />
    </div>
  );
}
