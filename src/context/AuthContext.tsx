import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError, getToken, setToken, TOKEN_KEY } from "../api/client";
import type { Member } from "../types";

interface AuthState {
  member: Member | null;
  loading: boolean;
  signIn: (code: string) => Promise<void>;
  /** forget: also forget this browser's super-key guest (the menu's Sign out). */
  signOut: (opts?: { forget?: boolean }) => void;
}

// The private guest this browser became with a super key (2026-10-27): entering the
// super key again returns to it, with its chats and trips, instead of a new empty one.
const GUEST_KEY = "tripagent.guest";
const isGuestCode = (c: string) => /^G\d[A-Z0-9]{10}$/.test(c);
function rememberedGuest(): string | null {
  try { return localStorage.getItem(GUEST_KEY); } catch { return null; }
}
function rememberGuest(code: string | null) {
  try { if (code) localStorage.setItem(GUEST_KEY, code); else localStorage.removeItem(GUEST_KEY); } catch { /* storage blocked */ }
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

  // The session is shared by every tab of this site (one token in localStorage). When
  // another tab signs in as someone else, or signs out, this tab reloads as that
  // session, so its menu never shows one member while it reads another's chats and trips.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY && e.newValue !== e.oldValue) window.location.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const signIn = useCallback(async (code: string) => {
    const gen = ++generation.current;
    // A new code replaces whatever was signed in before, even if it fails.
    setToken(null);
    setMember(null);
    const res = await api.post<{ member: Member; token: string }>("/api/session", { code, guest: rememberedGuest() });
    if (gen !== generation.current) return;
    if (isGuestCode(res.member.code)) rememberGuest(res.member.code);
    setToken(res.token);
    setMember(res.member);
    setLoading(false);
  }, []);

  const signOut = useCallback((opts?: { forget?: boolean }) => {
    generation.current++;
    if (opts && opts.forget) rememberGuest(null);
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
