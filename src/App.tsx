import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import TripDetail from "./pages/TripDetail";
import Trips from "./pages/Trips";

function Protected({ children }: { children: JSX.Element }) {
  const { member, loading } = useAuth();
  if (loading) return <p className="muted">Loading...</p>;
  if (!member) return <Navigate to="/login" replace />;
  return children;
}

function Layout({ children }: { children: JSX.Element }) {
  const { member, signOut } = useAuth();
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand">TripAgent</span>
        <nav>
          <NavLink to="/chat">Chat</NavLink>
          <NavLink to="/trips">Trips</NavLink>
        </nav>
        {member && (
          <button className="link-button" onClick={signOut}>
            Sign out ({member.name})
          </button>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/chat"
          element={
            <Protected>
              <Layout>
                <Chat />
              </Layout>
            </Protected>
          }
        />
        <Route
          path="/trips"
          element={
            <Protected>
              <Layout>
                <Trips />
              </Layout>
            </Protected>
          }
        />
        <Route
          path="/trips/:key"
          element={
            <Protected>
              <Layout>
                <TripDetail />
              </Layout>
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </AuthProvider>
  );
}
