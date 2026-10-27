import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ApiError, AuthProvider, useAuth } from "./context/AuthContext";
import AuthScreen from "./design/AuthScreen";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import TripDetail from "./pages/TripDetail";
import Trips from "./pages/Trips";

function Protected({ children }: { children: JSX.Element }) {
  const { member, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthScreen><p className="tc-auth__status">Loading...</p></AuthScreen>;
  // Remember where they were headed (e.g. an itinerary link from WhatsApp).
  if (!member) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/**
 * One login with the customer site: a member signed in there opens Tara at /chat#code=XXXX
 * and is signed in with the same code, without typing it (/login#code=XXXX still works). The
 * code is read once and cleared from the address bar before anything else, then they land on
 * /chat, so the link they see and share is just /chat. A code that is refused goes to the
 * login page with the reason.
 */
function CodeHandoff({ children }: { children: JSX.Element }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [code] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("code"));
  const [working, setWorking] = useState(!!code);
  const tried = useRef(false);
  useEffect(() => {
    if (!code || tried.current) return;
    tried.current = true;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    signIn(code.replace(/\s+/g, "").toUpperCase())
      .then(() => navigate("/chat", { replace: true }))
      .catch((err) =>
        navigate("/login", { replace: true, state: { error: err instanceof ApiError ? err.message : "Something went wrong." } }),
      )
      .finally(() => setWorking(false));
  }, [code, signIn, navigate]);
  return working ? <AuthScreen><p className="tc-auth__status">Signing you in...</p></AuthScreen> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <CodeHandoff>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/chat"
          element={
            // Full-screen Tara surface; the app nav lives in its header.
            <Protected>
              <Chat />
            </Protected>
          }
        />
        <Route
          path="/trips"
          element={
            // Full-screen Tara surface; the app nav lives in its header.
            <Protected>
              <Trips />
            </Protected>
          }
        />
        <Route
          path="/trips/:key"
          element={
            // Full-width itinerary page with its own header (the TripAgent
            // wordmark links back to chat), not the app's 720px column.
            <Protected>
              <TripDetail />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
      </CodeHandoff>
    </AuthProvider>
  );
}
