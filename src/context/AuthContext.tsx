import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, getToken, setToken } from "../api/client";
import type { Member } from "../types";

interface AuthState {
  member: Member | null;
  loading: boolean;
  signIn: (code: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get<{ member: Member }>("/api/session")
      .then((res) => setMember(res.member))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (code: string) => {
    const res = await api.post<{ member: Member; token: string }>("/api/session", { code });
    setToken(res.token);
    setMember(res.member);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setMember(null);
  }, []);

  return <AuthContext.Provider value={{ member, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
