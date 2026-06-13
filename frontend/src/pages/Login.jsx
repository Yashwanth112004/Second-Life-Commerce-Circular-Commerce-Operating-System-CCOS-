import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

const DEMOS = [
  { email: "alex@example.com", label: "Customer" },
  { email: "jordan@example.com", label: "Seller" },
  { email: "esg@example.com", label: "Enterprise" },
  { email: "admin@example.com", label: "Admin" },
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("alex@example.com");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const dest = loc.state && loc.state.from ? loc.state.from.pathname : "/dashboard";

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      nav(dest, { replace: true });
    } catch (err) {
      const msg = err.response && err.response.data ? err.response.data.error : err.message;
      setError(msg || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-extrabold text-white">Sign in</h1>
      <p className="mt-1 text-sm text-slate-400">Welcome back to the circular economy.</p>
      <form onSubmit={submit} className="card mt-5 space-y-4">
        {error && <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-300">{error}</div>}
        <label className="block">
          <span className="text-sm text-slate-400">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required
            className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-white outline-none focus:border-leaf-500" />
        </label>
        <label className="block">
          <span className="text-sm text-slate-400">Password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required
            className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-white outline-none focus:border-leaf-500" />
        </label>
        <button disabled={busy} className="btn-primary w-full">{busy ? "Signing in…" : "Sign in"}</button>
      </form>

      <div className="card mt-4">
        <div className="text-sm font-semibold text-white">Demo accounts (password: Password123!)</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {DEMOS.map((d) => (
            <button key={d.email} onClick={() => setEmail(d.email)}
              className="pill border border-white/15 text-slate-300 hover:bg-white/5">
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-slate-400">
        No account? <Link to="/register" className="text-leaf-400">Create one</Link>
      </p>
    </div>
  );
}
