import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, useAuth } from "../context/AuthContext";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(code.trim().toUpperCase());
      navigate("/chat");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>TripAgent</h1>
        <p>Enter your access code to continue.</p>
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="AB1234CD"
          maxLength={20}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy || !code.trim()}>
          {busy ? "Signing in..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
