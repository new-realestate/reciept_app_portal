import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { usersApi } from "../api/users";
import { ApiError } from "../lib/apiClient";
import { applyBusinessTheme } from "../lib/brandTheme";
import type { BusinessBranding, Me, Permission } from "../lib/types";
import { setSiteName } from "../hooks/useDocumentTitle";
import { ErrorState, Spinner } from "../components/ui/ui";
import { useAuth } from "./AuthContext";
import { hasPermission } from "./permissions";

interface AccessContextValue {
  me: Me;
  business: BusinessBranding | null;
  isManager: boolean;
  can: (perm: Permission) => boolean;
  /** Reload after something that changes the caller's own access (rare). */
  refresh: () => Promise<void>;
}

const AccessContext = createContext<AccessContextValue | undefined>(undefined);

/**
 * Loads the signed-in member's permissions and assigned properties once per session.
 * Used only to decide what to show: the API enforces every rule itself.
 */
export function AccessProvider({ children }: { children?: ReactNode }) {
  const { session } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const loaded = await usersApi.me();
      setMe(loaded);
      // Everyone in the business sees its name and accent colour.
      applyBusinessTheme(loaded.business?.brand_color);
      setSiteName(loaded.business?.name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your account.");
    }
  }, []);

  const token = session?.token;
  useEffect(() => {
    setMe(null);
    if (token) load();
  }, [token, load]);

  const value = useMemo<AccessContextValue | undefined>(
    () =>
      me
        ? { me, business: me.business, isManager: me.is_manager, can: (perm: Permission) => hasPermission(me, perm), refresh: load }
        : undefined,
    [me, load],
  );

  if (error) {
    return (
      <div className="full-page-center">
        <ErrorState title="Couldn't load your account" message={error} onRetry={load} />
      </div>
    );
  }
  if (!value) {
    return (
      <div className="full-page-center">
        <Spinner label="Loading your account…" />
      </div>
    );
  }
  return <AccessContext.Provider value={value}>{children ?? <Outlet />}</AccessContext.Provider>;
}

export function useAccess() {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccess must be used within AccessProvider");
  return ctx;
}

/** For tests and isolated components: provide a fixed access value. */
export function StaticAccessProvider({ me, children }: { me: Me; children: ReactNode }) {
  const value = useMemo(
    () => ({
      me,
      business: me.business,
      isManager: me.is_manager,
      can: (perm: Permission) => hasPermission(me, perm),
      refresh: async () => undefined,
    }),
    [me],
  );
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}
