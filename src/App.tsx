import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import TripDetail from "./pages/TripDetail";
import Trips from "./pages/Trips";

function Protected({ children }: { children: JSX.Element }) {
  const { member, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="muted">Loading...</p>;
  // Remember where they were headed (e.g. an itinerary link from WhatsApp).
  if (!member) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
