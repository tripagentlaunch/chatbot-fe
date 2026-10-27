import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError, useAuth } from "../context/AuthContext";
import AuthScreen from "../design/AuthScreen";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  // Back to the page that sent them here (only same-site /trips/... paths), else chat.
  const from = (useLocation().state as { from?: string } | null)?.from;
  const next = from && from.startsWith("/trips/") ? from : "/chat";
  const [code, setCode] = useState("");
  // A code the customer site handed over that was refused (see App.tsx CodeHandoff) arrives with its reason.
  const [error, setError] = useState<string | null>((useLocation().state as { error?: string } | null)?.error ?? null);
  const [busy, setBusy] = useState(false);

  // One login with the customer site (2026-10-09): a member signed in there
  // who opens Tara arrives at /login#code=XXXX and is signed in here with the
  // same code, without typing it. The code is read from the #fragment (never
  // sent to a server or logged) and cleared from the address bar first.
  const handoffTried = useRef(false);
  // Codes copied from the invite email can carry spaces between letters.
  const clean = (v: string) => v.replace(/\s+/g, "").toUpperCase();
  useEffect(() => {
    if (handoffTried.current) return;
    handoffTried.current = true;
    const handoff = new URLSearchParams(window.location.hash.slice(1)).get("code");
    if (!handoff) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setCode(clean(handoff));
    setBusy(true);
    signIn(clean(handoff))
      .then(() => navigate(next, { replace: true }))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Something went wrong."))
      .finally(() => setBusy(false));
  }, [signIn, navigate, next]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(clean(code));
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen>
      <form className="tc-auth__card" onSubmit={onSubmit}>
        <span className="tc-wordmark">TripAgent</span>
        <h1>Welcome.</h1>
        <p>Enter your access code to continue.</p>
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="AB1234CD"
          maxLength={40}
        />
        {error && <p className="tc-auth__error">{error}</p>}
        <button type="submit" disabled={busy || !code.trim()}>
          {busy ? "Signing in..." : "Continue"}
        </button>
      </form>
    </AuthScreen>
  );
}
