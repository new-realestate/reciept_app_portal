import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../lib/types";

/** Renders children only when the current user's role passes `allow`; otherwise renders `fallback`. */
export function RoleGate({
  allow,
  fallback = null,
  children,
}: {
  allow: (role: UserRole) => boolean;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { session } = useAuth();
  if (!session || !allow(session.role)) return <>{fallback}</>;
  return <>{children}</>;
}
