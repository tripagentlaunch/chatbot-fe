import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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

  // Bumped by every sign-in/out (2026-10-12): the saved-session check below
  // could finish after a fresh sign-in and put the previous member (an old
  // code) back. Results from an earlier generation are ignored.
  const generation = useRef(0);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    const gen = generation.current;
    api
      .get<{ member: Member }>("/api/session")
      .then((res) => {
        if (gen === generation.current) setMember(res.member);
      })
      .catch(() => {
        if (gen === generation.current) setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (code: string) => {
    const gen = ++generation.current;
    // A new code replaces whatever was signed in before, even if it fails.
    setToken(null);
    setMember(null);
    const res = await api.post<{ member: Member; token: string }>("/api/session", { code });
    if (gen !== generation.current) return;
    setToken(res.token);
    setMember(res.member);
    setLoading(false);
  }, []);

  const signOut = useCallback(() => {
    generation.current++;
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

/** Who the member talks to: their advisor's name when they have one, otherwise "your advisor". */
export function useAssistantName(): string {
  return useAuth().member?.advisorName?.trim() || "your advisor";
}

/** The name at the start of a sentence or as a label ("Your advisor"). */
export const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export { ApiError };
