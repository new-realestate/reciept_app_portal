import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import { usersApi } from "../api/users";
import { ApiError } from "../lib/apiClient";
import { qk } from "../lib/queryKeys";
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
 * Loads the signed-in member's permissions and assigned properties (cached per session token,
 * re-checked in the background when the window regains focus).
 * Used only to decide what to show: the API enforces every rule itself.
 */
export function AccessProvider({ children }: { children?: ReactNode }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const token = session?.token;
  const query = useQuery({ queryKey: qk.me(token), queryFn: usersApi.me, enabled: Boolean(token) });
  const me = query.data ?? null;

  useEffect(() => {
    if (!me) return;
    // Everyone in the business sees its name and accent colour.
    applyBusinessTheme(me.business?.brand_color);
    setSiteName(me.business?.name);
  }, [me]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.me(token) });
  }, [queryClient, token]);

  const value = useMemo<AccessContextValue | undefined>(
    () =>
      me
        ? { me, business: me.business, isManager: me.is_manager, can: (perm: Permission) => hasPermission(me, perm), refresh }
        : undefined,
    [me, refresh],
  );

  if (query.error && !me) {
    const message = query.error instanceof ApiError ? query.error.message : "Could not load your account.";
    return (
      <div className="full-page-center">
        <ErrorState title="Couldn't load your account" message={message} onRetry={() => query.refetch()} />
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
