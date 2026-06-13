import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ReturnWizard from "./pages/ReturnWizard.jsx";
import Marketplace from "./pages/Marketplace.jsx";
import Wallet from "./pages/Wallet.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Passport from "./pages/Passport.jsx";
import Impact from "./pages/Impact.jsx";
import Agent from "./pages/Agent.jsx";
import Concierge from "./Concierge.jsx";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-10 text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function Nav() {
  const { user, logout } = useAuth();
  const links = [
    { to: "/", label: "Home", end: true },
    { to: "/marketplace", label: "Marketplace" },
    { to: "/impact", label: "Impact" },
    { to: "/return", label: "Return Wizard", auth: true },
    { to: "/agent", label: "Resale Agent", auth: true },
    { to: "/dashboard", label: "Command Center", auth: true },
    { to: "/wallet", label: "Wallet", auth: true },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <NavLink to="/" className="flex items-center gap-2 font-extrabold text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-leaf-500 text-ink-950">♺</span>
          Second Life<span className="text-leaf-400">Commerce</span>
        </NavLink>
        <nav className="flex items-center gap-1">
          {links
            .filter((l) => !l.auth || user)
            .map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          {user ? (
            <button onClick={logout} className="ml-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white">
              Logout ({user.name.split(" ")[0]})
            </button>
          ) : (
            <NavLink to="/login" className="ml-2 btn-primary px-4 py-2 text-sm">
              Sign in
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Nav />
      <Concierge />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/impact" element={<Impact />} />
          <Route path="/passport/:orderId" element={<Passport />} />
          <Route path="/return" element={<ProtectedRoute><ReturnWizard /></ProtectedRoute>} />
          <Route path="/agent" element={<ProtectedRoute><Agent /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
        </Routes>
      </main>
      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-500">
        Second Life Commerce — Circular Commerce Operating System
      </footer>
    </div>
  );
}
