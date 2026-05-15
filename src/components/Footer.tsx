import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function Footer() {
  const { pathname } = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const isPublicLanding = pathname === "/" && !isAuthenticated && !authLoading;

  return (
    <footer className="mt-20 border-t border-white/[0.07] bg-black/20">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-sm font-semibold text-white">Sitropix</p>
          <p className="mt-1 text-xs text-ink-muted">Premium support for teams shipping in the US and globally.</p>
        </div>
        {!isPublicLanding && (
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted" aria-label="Footer">
            <Link className="hover:text-white" to="/kb">
              Knowledge Base
            </Link>
            <Link className="hover:text-white" to="/requests">
              My Requests
            </Link>
            <Link className="hover:text-white" to="/dashboard">
              Subscription
            </Link>
          </nav>
        )}
      </div>
    </footer>
  );
}
