import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ToastProvider } from "./components/ToastContext";
import { ProtectedRoute, RequirePlatformAdmin } from "./components/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { PlatformShell } from "./components/layout/PlatformShell";
import {
  PlatformAuditPage,
  PlatformBusinessDetailPage,
  PlatformBusinessesPage,
  PlatformDashboardPage,
  PlatformUsersPage,
} from "./pages/platform/PlatformPages";
import { LoginPage } from "./pages/auth/LoginPage";
import { SignupPage } from "./pages/auth/SignupPage";
import { VerifyEmailPage } from "./pages/auth/VerifyEmailPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { ReceiptsPage } from "./pages/ReceiptsPage";
import { NewReceiptPage } from "./pages/NewReceiptPage";
import { ReceiptDetailPage } from "./pages/ReceiptDetailPage";
import { CustomersPage } from "./pages/CustomersPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminPortalPage } from "./pages/AdminPortalPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { InvoiceDetailPage } from "./pages/InvoiceDetailPage";
import { QuotationsPage } from "./pages/QuotationsPage";
import { QuotationDetailPage } from "./pages/QuotationDetailPage";
import { EditInvoicePage, EditQuotationPage, NewInvoicePage, NewQuotationPage } from "./pages/DocumentFormPages";
import { NewSchedulePage, ScheduleDetailPage, SchedulesPage } from "./pages/SchedulePages";
import { RemindersPage } from "./pages/RemindersPage";
import { AuditLogPage } from "./pages/AuditLogPage";

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
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/new" element={<NewInvoicePage />} />
          <Route path="/invoices/:invoiceId" element={<InvoiceDetailPage />} />
          <Route path="/invoices/:invoiceId/edit" element={<EditInvoicePage />} />
          <Route path="/quotations" element={<QuotationsPage />} />
          <Route path="/quotations/new" element={<NewQuotationPage />} />
          <Route path="/quotations/:quotationId" element={<QuotationDetailPage />} />
          <Route path="/quotations/:quotationId/edit" element={<EditQuotationPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/schedules/new" element={<NewSchedulePage />} />
          <Route path="/schedules/:scheduleId" element={<ScheduleDetailPage />} />
          <Route path="/reminders" element={<RemindersPage />} />
          <Route path="/receipts" element={<ReceiptsPage />} />
          <Route path="/receipts/new" element={<NewReceiptPage />} />
          <Route path="/receipts/:receiptId" element={<ReceiptDetailPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPortalPage />} />
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
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}
