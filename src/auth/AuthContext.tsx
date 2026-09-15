import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import { getStoredToken, onUnauthorized, setStoredToken } from "../lib/apiClient";
import type { AuthSession, JwtClaims } from "../lib/types";

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  loginWithToken: (token: string) => void;
  logout: () => void;
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
    setSession(null);
  }, []);

  const loginWithToken = useCallback((token: string) => {
    setStoredToken(token);
    setSession(sessionFromToken(token));
  }, []);

  useEffect(() => {
    const existing = getStoredToken();
    if (existing) {
      const restored = sessionFromToken(existing);
      if (restored) {
        setSession(restored);
      } else {
        setStoredToken(null);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    onUnauthorized(() => logout());
  }, [logout]);

  const value = useMemo(() => ({ session, isLoading, loginWithToken, logout }), [session, isLoading, loginWithToken, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
