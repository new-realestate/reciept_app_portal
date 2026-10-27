import { lazy, Suspense, type ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ToastProvider } from "./components/ToastContext";
import { ProtectedRoute, RequirePlatformAdmin } from "./components/ProtectedRoute";
import { PageLoading } from "./components/PageLoading";
import { AppShell } from "./components/layout/AppShell";
import { PlatformShell } from "./components/layout/PlatformShell";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { VerifyEmailPage } from "./pages/auth/VerifyEmailPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AccessProvider } from "./auth/AccessContext";
import { RequirePerm } from "./components/RequirePerm";

// Pages load on first visit, so the first download is just the shell and the page you open.
function lazyPage<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}

const PlatformAuditPage = lazyPage(() => import("./pages/platform/PlatformPages"), "PlatformAuditPage");
const PlatformBusinessDetailPage = lazyPage(() => import("./pages/platform/PlatformPages"), "PlatformBusinessDetailPage");
const PlatformBusinessesPage = lazyPage(() => import("./pages/platform/PlatformPages"), "PlatformBusinessesPage");
const PlatformDashboardPage = lazyPage(() => import("./pages/platform/PlatformPages"), "PlatformDashboardPage");
const PlatformUsersPage = lazyPage(() => import("./pages/platform/PlatformPages"), "PlatformUsersPage");
const ReceiptsPage = lazyPage(() => import("./pages/ReceiptsPage"), "ReceiptsPage");
const NewReceiptPage = lazyPage(() => import("./pages/NewReceiptPage"), "NewReceiptPage");
const ReceiptDetailPage = lazyPage(() => import("./pages/ReceiptDetailPage"), "ReceiptDetailPage");
const CustomersPage = lazyPage(() => import("./pages/CustomersPage"), "CustomersPage");
const ProfilePage = lazyPage(() => import("./pages/ProfilePage"), "ProfilePage");
const AdminPortalPage = lazyPage(() => import("./pages/AdminPortalPage"), "AdminPortalPage");
const DashboardPage = lazyPage(() => import("./pages/DashboardPage"), "DashboardPage");
const InvoicesPage = lazyPage(() => import("./pages/InvoicesPage"), "InvoicesPage");
const InvoiceDetailPage = lazyPage(() => import("./pages/InvoiceDetailPage"), "InvoiceDetailPage");
const QuotationsPage = lazyPage(() => import("./pages/QuotationsPage"), "QuotationsPage");
const QuotationDetailPage = lazyPage(() => import("./pages/QuotationDetailPage"), "QuotationDetailPage");
const EditInvoicePage = lazyPage(() => import("./pages/DocumentFormPages"), "EditInvoicePage");
const EditQuotationPage = lazyPage(() => import("./pages/DocumentFormPages"), "EditQuotationPage");
const NewInvoicePage = lazyPage(() => import("./pages/DocumentFormPages"), "NewInvoicePage");
const NewQuotationPage = lazyPage(() => import("./pages/DocumentFormPages"), "NewQuotationPage");
const NewSchedulePage = lazyPage(() => import("./pages/SchedulePages"), "NewSchedulePage");
const ScheduleDetailPage = lazyPage(() => import("./pages/SchedulePages"), "ScheduleDetailPage");
const SchedulesPage = lazyPage(() => import("./pages/SchedulePages"), "SchedulesPage");
const RemindersPage = lazyPage(() => import("./pages/RemindersPage"), "RemindersPage");
const AuditLogPage = lazyPage(() => import("./pages/AuditLogPage"), "AuditLogPage");
const PropertiesPage = lazyPage(() => import("./pages/PropertyPages"), "PropertiesPage");
const PropertyDetailPage = lazyPage(() => import("./pages/PropertyPages"), "PropertyDetailPage");
const TeamMemberPage = lazyPage(() => import("./pages/TeamPages"), "TeamMemberPage");
const TeamPage = lazyPage(() => import("./pages/TeamPages"), "TeamPage");
const NewRenterPage = lazyPage(() => import("./pages/RenterPages"), "NewRenterPage");
const RenterDetailPage = lazyPage(() => import("./pages/RenterPages"), "RenterDetailPage");
const RentersPage = lazyPage(() => import("./pages/RenterPages"), "RentersPage");
const CustomerDetailPage = lazyPage(() => import("./pages/CustomerDetailPage"), "CustomerDetailPage");
const KycProfilePage = lazyPage(() => import("./pages/KycReviewPage"), "KycProfilePage");
const KycReviewPage = lazyPage(() => import("./pages/KycReviewPage"), "KycReviewPage");

function RootRedirect() {
  const { session } = useAuth();
  const home = session?.isSuperadmin && !session.impersonating ? "/platform" : "/dashboard";
  return <Navigate to={session ? home : "/login"} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AccessProvider />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/properties" element={<PropertiesPage />} />
            <Route path="/properties/:propertyId" element={<PropertyDetailPage />} />
            <Route path="/tenants" element={<RequirePerm perm="renters.manage"><RentersPage /></RequirePerm>} />
            <Route path="/tenants/new" element={<RequirePerm perm="renters.manage"><NewRenterPage /></RequirePerm>} />
            <Route path="/tenants/:renterId" element={<RequirePerm perm="renters.manage"><RenterDetailPage /></RequirePerm>} />
            <Route path="/team" element={<RequirePerm managerOnly><TeamPage /></RequirePerm>} />
            <Route path="/team/:memberId" element={<RequirePerm managerOnly><TeamMemberPage /></RequirePerm>} />
            <Route path="/kyc" element={<RequirePerm anyOf={["renters.kyc_review"]}><KycReviewPage /></RequirePerm>} />
            <Route path="/kyc/:profileId" element={<KycProfilePage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/invoices/new" element={<RequirePerm perm="invoices.issue"><NewInvoicePage /></RequirePerm>} />
            <Route path="/invoices/:invoiceId" element={<InvoiceDetailPage />} />
            <Route path="/invoices/:invoiceId/edit" element={<EditInvoicePage />} />
            <Route path="/quotations" element={<QuotationsPage />} />
            <Route path="/quotations/new" element={<RequirePerm perm="quotations.issue"><NewQuotationPage /></RequirePerm>} />
            <Route path="/quotations/:quotationId" element={<QuotationDetailPage />} />
            <Route path="/quotations/:quotationId/edit" element={<EditQuotationPage />} />
            <Route path="/schedules" element={<SchedulesPage />} />
            <Route path="/schedules/new" element={<RequirePerm perm="invoices.issue"><NewSchedulePage /></RequirePerm>} />
            <Route path="/schedules/:scheduleId" element={<ScheduleDetailPage />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route path="/receipts" element={<ReceiptsPage />} />
            <Route path="/receipts/new" element={<RequirePerm perm="receipts.issue"><NewReceiptPage /></RequirePerm>} />
            <Route path="/receipts/:receiptId" element={<ReceiptDetailPage />} />
            <Route path="/customers" element={<RequirePerm perm="customers.view"><CustomersPage /></RequirePerm>} />
            <Route path="/customers/:customerId" element={<RequirePerm perm="customers.view"><CustomerDetailPage /></RequirePerm>} />
            <Route path="/audit-log" element={<RequirePerm managerOnly><AuditLogPage /></RequirePerm>} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPortalPage />} />
          </Route>
        </Route>
      </Route>

      <Route element={<RequirePlatformAdmin />}>
        <Route element={<PlatformShell />}>
          <Route path="/platform" element={<PlatformDashboardPage />} />
          <Route path="/platform/businesses" element={<PlatformBusinessesPage />} />
          <Route path="/platform/businesses/:tenantId" element={<PlatformBusinessDetailPage />} />
          <Route path="/platform/users" element={<PlatformUsersPage />} />
          <Route path="/platform/audit-log" element={<PlatformAuditPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<PageLoading />}>
            <AppRoutes />
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
