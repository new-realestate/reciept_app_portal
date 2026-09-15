import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ToastProvider } from "./components/ToastContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
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

function RootRedirect() {
  const { session } = useAuth();
  return <Navigate to={session ? "/receipts" : "/login"} replace />;
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
          <Route path="/receipts" element={<ReceiptsPage />} />
          <Route path="/receipts/new" element={<NewReceiptPage />} />
          <Route path="/receipts/:receiptId" element={<ReceiptDetailPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPortalPage />} />
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
