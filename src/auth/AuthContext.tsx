import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import { getStoredAdminToken, getStoredToken, onUnauthorized, setStoredAdminToken, setStoredToken } from "../lib/apiClient";
import type { AuthSession, JwtClaims } from "../lib/types";

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  loginWithToken: (token: string) => void;
  logout: () => void;
  /** Super admin: switch to an act-as-business token, keeping their own to return to. */
  startImpersonation: (token: string) => void;
  /** Super admin: drop the act-as token and return to their own session. */
  stopImpersonation: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function sessionFromToken(token: string): AuthSession | null {
  try {
    const claims = jwtDecode<JwtClaims>(token);
    if (!claims.exp || claims.exp * 1000 < Date.now()) return null;
    return {
      token,
      userId: claims.sub,
      tenantId: claims.tenant_id,
      role: claims.role,
      email: "",
      isSuperadmin: Boolean(claims.sa),
      impersonating:
        claims.imp && claims.act_tenant_id
          ? { tenantId: claims.act_tenant_id, businessName: claims.act_tenant_name ?? "Business" }
          : null,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setStoredToken(null);
    setStoredAdminToken(null);
    setSession(null);
  }, []);

  const loginWithToken = useCallback((token: string) => {
    setStoredAdminToken(null);
    setStoredToken(token);
    setSession(sessionFromToken(token));
  }, []);

  const startImpersonation = useCallback((token: string) => {
    const own = getStoredToken();
    if (own) setStoredAdminToken(own);
    setStoredToken(token);
    setSession(sessionFromToken(token));
  }, []);

  const stopImpersonation = useCallback(() => {
    const own = getStoredAdminToken();
    const restored = own ? sessionFromToken(own) : null;
    setStoredAdminToken(null);
    if (own && restored) {
      setStoredToken(own);
      setSession(restored);
    } else {
      setStoredToken(null);
      setSession(null);
    }
  }, []);

  useEffect(() => {
    const existing = getStoredToken();
    const restored = existing ? sessionFromToken(existing) : null;
    if (restored) {
      setSession(restored);
    } else if (getStoredAdminToken()) {
      // The act-as token expired while away; fall back to the super admin's own session.
      stopImpersonation();
    } else if (existing) {
      setStoredToken(null);
    }
    setIsLoading(false);
  }, [stopImpersonation]);

  useEffect(() => {
    // An expired or rejected act-as token returns the super admin to their own session.
    onUnauthorized(() => (getStoredAdminToken() ? stopImpersonation() : logout()));
  }, [logout, stopImpersonation]);

  const value = useMemo(
    () => ({ session, isLoading, loginWithToken, logout, startImpersonation, stopImpersonation }),
    [session, isLoading, loginWithToken, logout, startImpersonation, stopImpersonation],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
