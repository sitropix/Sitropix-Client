import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { ClientPortalShell } from "@/components/ClientPortalShell";
import { AdminPortalShell } from "@/components/AdminPortalShell";
import { isAdminPath } from "@/lib/adminAccess";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import { SubscriptionPortalProvider } from "@/context/SubscriptionPortalContext";

// Routes that bring their own brand-aligned chrome (header + footer).
// They render bare — no legacy Navbar/Footer wrap.
const SELF_CONTAINED_PUBLIC_PATHS = ["/", "/community"];

export function Layout() {
  const { pathname } = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { canAccessAdminPortal } = useAuthz();

  const clientPortalPaths = [
    "/dashboard",
    "/subscription-management",
    "/billing",
    "/client-dashboard",
    "/subscription",
    "/plans",
    "/workspace",
    "/files",
    "/projects",
    "/requests",
    "/tickets",
    "/support/tickets",
    "/kb",
    "/help",
    "/search",
    "/profile",
    "/account",
    "/ticket",
  ];
  const isClientPortalPath = clientPortalPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const useClientPortalShell =
    isClientPortalPath && (isAuthenticated || authLoading);
  const onAdminPath = isAdminPath(pathname);
  const useAdminShell =
    onAdminPath &&
    (isAuthenticated || authLoading) &&
    (authLoading || canAccessAdminPortal);

  if (useAdminShell) {
    return (
      <AdminPortalShell>
        <Outlet />
      </AdminPortalShell>
    );
  }

  if (useClientPortalShell) {
    return (
      <SubscriptionPortalProvider>
        <ClientPortalShell>
          <Outlet />
        </ClientPortalShell>
      </SubscriptionPortalProvider>
    );
  }

  // Self-contained public pages (HomePage, CommunityPage, NotFoundPage) own their chrome.
  if (SELF_CONTAINED_PUBLIC_PATHS.includes(pathname)) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}
