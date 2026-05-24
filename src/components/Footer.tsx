import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function Footer() {
  const { pathname } = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const isPublicLanding = pathname === "/" && !isAuthenticated && !authLoading;

  return (
    <footer className="mt-16 border-t border-[var(--border-subtle)] bg-[var(--surface-card)]">
      <div className="mx-auto flex max-w-[var(--container-wide)] flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="text-sx-xs text-[var(--text-tertiary)]">
          © {new Date().getFullYear()} Sitropix · Maintained by{" "}
          <a
            href="https://www.draconx.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--text-brand)] hover:underline"
          >
            DraconX
          </a>
          .
        </div>
        {!isPublicLanding && (
          <nav
            className="flex flex-wrap gap-x-5 gap-y-2 text-sx-xs text-[var(--text-tertiary)]"
            aria-label="Footer"
          >
            <Link className="hover:text-[var(--text-primary)]" to="/help">
              Help
            </Link>
            <Link className="hover:text-[var(--text-primary)]" to="/tickets">
              Tickets
            </Link>
            <Link className="hover:text-[var(--text-primary)]" to="/billing">
              Billing
            </Link>
          </nav>
        )}
      </div>
    </footer>
  );
}
