import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { ClientPortalShell } from "@/components/ClientPortalShell";
import { AdminPortalShell } from "@/components/AdminPortalShell";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import { SubscriptionPortalProvider } from "@/context/SubscriptionPortalContext";

export function Layout() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const { isAdmin } = useAuthz();

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  const clientPortalPaths = [
    "/dashboard",
    "/subscription-management",
    "/client-dashboard",
    "/subscription",
    "/billing",
    "/workspace",
    "/projects",
    "/requests",
    "/support/tickets",
    "/kb",
    "/search",
    "/profile",
    "/ticket",
  ];
  const isClientPortalPath = clientPortalPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const useClientPortalShell = isAuthenticated && isClientPortalPath;
  const useAdminShell =
    isAuthenticated &&
    isAdmin &&
    (pathname === "/admin" || pathname.startsWith("/admin/"));

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

  if (isAuthPage) {
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
