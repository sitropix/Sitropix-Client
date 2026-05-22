import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Layout } from "@/components/Layout";
import { RequireAdmin } from "@/components/RequireAdmin";
import { RequireAdminPortal } from "@/components/RequireAdminPortal";
import { RequireAdminRole } from "@/components/RequireAdminRole";
import { RequireCustomer } from "@/components/RequireCustomer";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/context/AuthContext";
import { AuthzProvider } from "@/context/AuthzContext";
import { AdminPrefetchProvider } from "@/context/AdminPrefetchContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { TicketsProvider } from "@/context/TicketsContext";
import { UserProvider } from "@/context/UserContext";
import { CommunityPage } from "@/pages/CommunityPage";
import { HomePage } from "@/pages/HomePage";
import { AdminAuditLogsPage } from "@/pages/admin/AdminAuditLogsPage";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { AdminProfilePage } from "@/pages/admin/AdminProfilePage";
import { AdminTicketDetailPage } from "@/pages/admin/AdminTicketDetailPage";
import { AdminTicketsPage } from "@/pages/admin/AdminTicketsPage";
import { AdminUserDocumentsPage } from "@/pages/admin/AdminUserDocumentsPage";
import { CustomerManagementPage } from "@/pages/admin/CustomerManagementPage";
import { EmailSettingsPage } from "@/pages/admin/EmailSettingsPage";
import { EmailTemplatesPage } from "@/pages/admin/EmailTemplatesPage";
import { EnvironmentConfigPage } from "@/pages/admin/EnvironmentConfigPage";
import { FeatureControlsPage } from "@/pages/admin/FeatureControlsPage";
import { InvitesPage } from "@/pages/admin/InvitesPage";
import { PlanManagementPage } from "@/pages/admin/PlanManagementPage";
import { UserManagementPage } from "@/pages/admin/UserManagementPage";

const LoginPage = lazy(() => import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import("@/pages/auth/SignupPage").then((m) => ({ default: m.SignupPage })));
const VerifyEmailPage = lazy(() => import("@/pages/auth/VerifyEmailPage").then((m) => ({ default: m.VerifyEmailPage })));
const ForgotPasswordPage = lazy(() =>
  import("@/pages/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import("@/pages/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);

const CustomerDashboardPage = lazy(() =>
  import("@/pages/subscription/CustomerDashboardPage").then((m) => ({ default: m.CustomerDashboardPage })),
);
const SubscriptionManagementPage = lazy(() =>
  import("@/pages/subscription/SubscriptionManagementPage").then((m) => ({ default: m.SubscriptionManagementPage })),
);
const SubscriptionPage = lazy(() =>
  import("@/pages/subscription/SubscriptionPage").then((m) => ({ default: m.SubscriptionPage })),
);
const WorkspacePage = lazy(() => import("@/pages/workspace/WorkspacePage").then((m) => ({ default: m.WorkspacePage })));
const MyProjectsPage = lazy(() =>
  import("@/pages/workspace/MyProjectsPage").then((m) => ({ default: m.MyProjectsPage })),
);
const ProjectSubscriptionPage = lazy(() =>
  import("@/pages/workspace/ProjectSubscriptionPage").then((m) => ({ default: m.ProjectSubscriptionPage })),
);
const ProjectDashboardPage = lazy(() =>
  import("@/pages/workspace/ProjectDashboardPage").then((m) => ({ default: m.ProjectDashboardPage })),
);
const ProjectManageAddonsPage = lazy(() =>
  import("@/pages/workspace/ProjectManageAddonsPage").then((m) => ({
    default: m.ProjectManageAddonsPage,
  })),
);
const ProjectAddonCheckoutPage = lazy(() =>
  import("@/pages/workspace/ProjectAddonCheckoutPage").then((m) => ({
    default: m.ProjectAddonCheckoutPage,
  })),
);
const AdminProjectsPage = lazy(() =>
  import("@/pages/admin/AdminProjectsPage").then((m) => ({ default: m.AdminProjectsPage })),
);
const KnowledgeBasePage = lazy(() =>
  import("@/pages/KnowledgeBasePage").then((m) => ({ default: m.KnowledgeBasePage })),
);
const PortalSearchPage = lazy(() =>
  import("@/pages/PortalSearchPage").then((m) => ({ default: m.PortalSearchPage })),
);
const ArticlePage = lazy(() => import("@/pages/ArticlePage").then((m) => ({ default: m.ArticlePage })));
const MyRequestsPage = lazy(() => import("@/pages/MyRequestsPage").then((m) => ({ default: m.MyRequestsPage })));
const TicketDetailPage = lazy(() =>
  import("@/pages/TicketDetailPage").then((m) => ({ default: m.TicketDetailPage })),
);
const SubmitTicketPage = lazy(() =>
  import("@/pages/SubmitTicketPage").then((m) => ({ default: m.SubmitTicketPage })),
);
const ProfilePage = lazy(() => import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const FormBuilderPage = lazy(() => import("@/pages/admin/FormBuilderPage").then((m) => ({ default: m.FormBuilderPage })));
const CrmManagementPage = lazy(() => import("@/pages/admin/CrmManagementPage").then((m) => ({ default: m.CrmManagementPage })));
const PublicEmbedFormPage = lazy(() =>
  import("@/pages/embed/PublicEmbedFormPage").then((m) => ({ default: m.PublicEmbedFormPage })),
);

function AppRouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-9 w-9" role="status" aria-label="Loading">
          <div className="absolute inset-0 rounded-full border-2 border-outline-variant/40" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent-gold" />
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Loading…</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ToastProvider>
        <AuthProvider>
          <AuthzProvider>
            <AdminPrefetchProvider>
              <UserProvider>
                <TicketsProvider>
                  <Suspense fallback={<AppRouteFallback />}>
                    <Routes>
                  <Route path="/embed/form/:embedKey" element={<PublicEmbedFormPage />} />
                  <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                  </Route>

                  <Route element={<Layout />}>
                    <Route path="/" element={<HomePage />} />
                    <Route
                      path="/dashboard"
                      element={
                        <RequireCustomer>
                          <CustomerDashboardPage />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/client-dashboard"
                      element={
                        <RequireCustomer>
                          <Navigate to="/subscription-management" replace />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/subscription-management"
                      element={
                        <RequireCustomer>
                          <SubscriptionManagementPage />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/subscription"
                      element={
                        <RequireCustomer>
                          <SubscriptionPage />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/billing"
                      element={
                        <RequireCustomer>
                          <Navigate to="/subscription-management" replace />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/workspace"
                      element={
                        <RequireCustomer>
                          <WorkspacePage />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/projects"
                      element={
                        <RequireCustomer>
                          <MyProjectsPage />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/projects/:projectId/subscription"
                      element={
                        <RequireCustomer>
                          <ProjectSubscriptionPage />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/projects/:projectId/add-ons/checkout"
                      element={
                        <RequireCustomer>
                          <ProjectAddonCheckoutPage />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/projects/:projectId/add-ons"
                      element={
                        <RequireCustomer>
                          <ProjectManageAddonsPage />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/projects/:projectId"
                      element={
                        <RequireCustomer>
                          <ProjectDashboardPage />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/admin"
                      element={
                        <RequireAdmin>
                          <AdminDashboardPage />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/email"
                      element={
                        <RequireAdmin>
                          <EmailSettingsPage />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/email-templates"
                      element={
                        <RequireAdmin>
                          <EmailTemplatesPage />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/environment"
                      element={
                        <RequireAdmin>
                          <EnvironmentConfigPage />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/features"
                      element={
                        <RequireAdmin>
                          <FeatureControlsPage />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/invites"
                      element={
                        <RequireAdmin>
                          <InvitesPage />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/plans"
                      element={
                        <RequireAdmin>
                          <PlanManagementPage />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/forms"
                      element={
                        <RequireAdmin>
                          <FormBuilderPage />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/crm"
                      element={
                        <RequireAdmin>
                          <CrmManagementPage />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/users/:userId/documents"
                      element={
                        <RequireAdmin>
                          <AdminUserDocumentsPage />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/customers"
                      element={
                        <RequireAdmin>
                          <CustomerManagementPage />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/tickets"
                      element={
                        <RequireAdminPortal>
                          <AdminTicketsPage />
                        </RequireAdminPortal>
                      }
                    />
                    <Route
                      path="/admin/tickets/:id"
                      element={
                        <RequireAdminPortal>
                          <AdminTicketDetailPage />
                        </RequireAdminPortal>
                      }
                    />
                    <Route
                      path="/admin/projects"
                      element={
                        <RequireAdmin>
                          <AdminProjectsPage />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/team-access"
                      element={
                        <RequireAdminRole>
                          <UserManagementPage />
                        </RequireAdminRole>
                      }
                    />
                    <Route
                      path="/admin/users"
                      element={
                        <RequireAdminRole>
                          <Navigate to="/admin/team-access" replace />
                        </RequireAdminRole>
                      }
                    />
                    <Route
                      path="/admin/audit-logs"
                      element={
                        <RequireAdmin>
                          <AdminAuditLogsPage />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/profile"
                      element={
                        <RequireAdmin>
                          <AdminProfilePage />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/requests"
                      element={
                        <RequireCustomer>
                          <MyRequestsPage />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/support/tickets/:id"
                      element={
                        <RequireCustomer>
                          <TicketDetailPage />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/search"
                      element={
                        <RequireCustomer>
                          <PortalSearchPage />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/kb"
                      element={
                        <RequireCustomer>
                          <KnowledgeBasePage />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/kb/article/:id"
                      element={
                        <RequireCustomer>
                          <ArticlePage />
                        </RequireCustomer>
                      }
                    />
                    <Route path="/community" element={<CommunityPage />} />
                    <Route
                      path="/profile"
                      element={
                        <RequireCustomer>
                          <ProfilePage />
                        </RequireCustomer>
                      }
                    />
                    <Route
                      path="/ticket"
                      element={
                        <RequireCustomer>
                          <SubmitTicketPage />
                        </RequireCustomer>
                      }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                  </Routes>
                </Suspense>
                </TicketsProvider>
              </UserProvider>
            </AdminPrefetchProvider>
          </AuthzProvider>
        </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
