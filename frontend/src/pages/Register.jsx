import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "customer", city: "Bengaluru" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      nav("/dashboard", { replace: true });
    } catch (err) {
      const d = err.response && err.response.data ? err.response.data : null;
      setError(d && d.details ? d.details.map((x) => x.message).join(", ") : (d && d.error) || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-extrabold text-white">Create your account</h1>
      <form onSubmit={submit} className="card mt-5 space-y-4">
        {error && <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-300">{error}</div>}
        <input placeholder="Full name" value={form.name} onChange={set("name")} required
          className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-white outline-none focus:border-leaf-500" />
        <input placeholder="Email" type="email" value={form.email} onChange={set("email")} required
          className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-white outline-none focus:border-leaf-500" />
        <input placeholder="Password (min 8 chars)" type="password" value={form.password} onChange={set("password")} required
          className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-white outline-none focus:border-leaf-500" />
        <div className="grid grid-cols-2 gap-3">
          <select value={form.role} onChange={set("role")}
            className="rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-white outline-none focus:border-leaf-500">
            <option value="customer">Customer</option>
            <option value="seller">Seller</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <input placeholder="City" value={form.city} onChange={set("city")}
            className="rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-white outline-none focus:border-leaf-500" />
        </div>
        <button disabled={busy} className="btn-primary w-full">{busy ? "Creating…" : "Create account"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">
        Already have an account? <Link to="/login" className="text-leaf-400">Sign in</Link>
      </p>
    </div>
  );
}
