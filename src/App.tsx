import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { RequireAdmin } from "@/components/RequireAdmin";
import { RequireCustomer } from "@/components/RequireCustomer";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { CustomerManagementPage } from "@/pages/admin/CustomerManagementPage";
import { PlanManagementPage } from "@/pages/admin/PlanManagementPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { SignupPage } from "@/pages/auth/SignupPage";
import { AuthProvider } from "@/context/AuthContext";
import { CustomerDashboardPage } from "@/pages/subscription/CustomerDashboardPage";
import { SubscriptionManagementPage } from "@/pages/subscription/SubscriptionManagementPage";
import { SubscriptionPage } from "@/pages/subscription/SubscriptionPage";
import { AuthzProvider } from "@/context/AuthzContext";
import { TicketsProvider } from "@/context/TicketsContext";
import { UserProvider } from "@/context/UserContext";
import { ArticlePage } from "@/pages/ArticlePage";
import { CommunityPage } from "@/pages/CommunityPage";
import { HomePage } from "@/pages/HomePage";
import { KnowledgeBasePage } from "@/pages/KnowledgeBasePage";
import { MyRequestsPage } from "@/pages/MyRequestsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { SubmitTicketPage } from "@/pages/SubmitTicketPage";
import { TicketDetailPage } from "@/pages/TicketDetailPage";
import { AdminTicketsPage } from "@/pages/admin/AdminTicketsPage";
import { AdminTicketDetailPage } from "@/pages/admin/AdminTicketDetailPage";
import { FeatureControlsPage } from "@/pages/admin/FeatureControlsPage";
import { EmailSettingsPage } from "@/pages/admin/EmailSettingsPage";
import { InvitesPage } from "@/pages/admin/InvitesPage";
import { AdminUserDocumentsPage } from "@/pages/admin/AdminUserDocumentsPage";
import { AdminAuditLogsPage } from "@/pages/admin/AdminAuditLogsPage";
import { UserManagementPage } from "@/pages/admin/UserManagementPage";
import { EnvironmentConfigPage } from "@/pages/admin/EnvironmentConfigPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { VerifyEmailPage } from "@/pages/auth/VerifyEmailPage";
import { WorkspacePage } from "@/pages/workspace/WorkspacePage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthzProvider>
          <UserProvider>
            <TicketsProvider>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
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
                      <RequireAdmin>
                        <AdminTicketsPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/admin/tickets/:id"
                    element={
                      <RequireAdmin>
                        <AdminTicketDetailPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/admin/users"
                    element={
                      <RequireAdmin>
                        <UserManagementPage />
                      </RequireAdmin>
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
            </TicketsProvider>
          </UserProvider>
        </AuthzProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
