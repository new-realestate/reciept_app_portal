import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Spinner } from "./ui/ui";

function SessionCheck() {
  return (
    <div className="full-page-center">
      <Spinner label="Checking your session…" />
    </div>
  );
}

/** Business pages. A platform super admin only gets here while acting as a business. */
export function ProtectedRoute() {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <SessionCheck />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (session.isSuperadmin && !session.impersonating) {
    return <Navigate to="/platform" replace />;
  }

  return <Outlet />;
}

/** Platform admin pages: super admins using their own session (not acting as a business). */
export function RequirePlatformAdmin() {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <SessionCheck />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!session.isSuperadmin || session.impersonating) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
