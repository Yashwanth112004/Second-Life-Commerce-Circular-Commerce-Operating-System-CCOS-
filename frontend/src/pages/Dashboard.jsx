import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Spinner, Stat } from "../components.jsx";

const tip = { background: "#0f1420", border: "1px solid #ffffff22", borderRadius: 12 };
const TIER_COLOR = {
  Beginner: "text-slate-300", Recycler: "text-sky-300", Advocate: "text-leaf-400",
  Champion: "text-amber-300", Legend: "text-fuchsia-300",
};

export default function Dashboard() {
  const { user } = useAuth();
  const role = user.role;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">
          {role === "seller" ? "Seller Dashboard" : role === "enterprise" || role === "admin" ? "Enterprise / ESG" : "Circular Command Center"}
        </h1>
        <p className="mt-1 text-slate-400">{user.name} · {user.city} · {role}</p>
      </div>
      {role === "seller" && <SellerDash />}
      {(role === "enterprise" || role === "admin") && <EnterpriseDash isAdmin={role === "admin"} />}
      {role === "customer" && <CommandCenter />}
    </div>
  );
}

function CommandCenter() {
  const dash = useQuery({ queryKey: ["dashCustomer"], queryFn: api.dashCustomer });
  const score = useQuery({ queryKey: ["circularScore"], queryFn: api.circularScore });
  const ara = useQuery({ queryKey: ["araSuggestions"], queryFn: api.araSuggestions });
  const orders = useQuery({ queryKey: ["myOrders"], queryFn: api.myOrders });

  if (dash.isLoading || score.isLoading) return <Spinner />;
  const d = dash.data;
  const s = score.data;
  const m = d.marketplace || {};

  return (
    <>
      {/* Circular Score hero */}
      <div className="card flex flex-wrap items-center justify-between gap-4 border-leaf-500/30">
        <div>
          <div className="text-sm text-slate-400">Your Circular Score</div>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-extrabold text-leaf-400">{s.score}</span>
            <span className={`text-xl font-bold ${TIER_COLOR[s.tier] || "text-white"}`}>{s.tier}</span>
          </div>
          <div className="mt-1 text-sm text-slate-400">
            Global #{s.global_rank}/{s.global_total} · {s.city} #{s.city_rank} · top {100 - s.percentile + 1}%
          </div>
        </div>
        <div className="h-24 w-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={Object.entries(s.breakdown).map(([k, v]) => ({ k, v }))}>
              <Bar dataKey="v" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Tooltip contentStyle={tip} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Owned products" value={d.owned_products} sub={`$${d.owned_value} value`} />
        <Stat label="Green Credits" value={`${d.wallet.green_credits} GC`} accent="text-leaf-400" />
        <Stat label="CO₂ saved" value={`${d.wallet.carbon_saved_kg} kg`} accent="text-leaf-400" />
        <Stat label="Returns resolved" value={d.activity.returns_resolved} sub={`${d.activity.circular_actions} circular actions`} />
      </div>

      {/* ARA highlight */}
      {ara.data && (
        <div className="card border-amber-400/30">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">⭐ Autonomous Resale Agent</h3>
            <Link to="/agent" className="text-sm text-leaf-400">Open agent →</Link>
          </div>
          <p className="mt-1 text-sm text-slate-300">{ara.data.headline}</p>
        </div>
      )}

      {/* Owned products with passport links */}
      {orders.data && (
        <div className="card">
          <h3 className="mb-3 font-bold text-white">Your products — every one has a Digital Product Passport</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orders.data.map((o) => (
              <Link key={o.id} to={`/passport/${o.id}`} className="flex items-center gap-3 rounded-lg bg-white/5 p-3 transition hover:bg-white/10">
                <img src={o.product.image_url} alt="" className="h-12 w-12 rounded object-cover" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{o.product.title}</div>
                  <div className="text-xs text-slate-400">est ${o.estimated_value} · {o.status}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SellerDash() {
  const q = useQuery({ queryKey: ["dashSeller"], queryFn: api.dashSeller });
  if (q.isLoading) return <Spinner />;
  const d = q.data;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Total listings" value={d.metrics.total_listings} />
        <Stat label="Sold" value={d.metrics.total_sold} />
        <Stat label="Revenue" value={`$${d.metrics.revenue}`} accent="text-leaf-400" />
        <Stat label="Circular score" value={d.metrics.circular_score} />
      </div>
      <div className="card">
        <h3 className="mb-3 font-bold text-white">Revenue by month</h3>
        {d.revenue_by_month.length === 0 ? <p className="text-sm text-slate-400">No sales yet.</p> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.revenue_by_month}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="revenue" fill="#22c55e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="card">
        <h3 className="mb-3 font-bold text-white">Top return root causes (AI)</h3>
        {d.top_return_root_causes.length === 0 ? <p className="text-sm text-slate-400">No return analyses yet.</p> : (
          <div className="space-y-2">
            {d.top_return_root_causes.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                <span className="text-slate-300">{r.reason}</span><span className="text-slate-400">{r.n}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function EnterpriseDash({ isAdmin }) {
  const q = useQuery({ queryKey: ["dashEnterprise"], queryFn: api.dashEnterprise });
  const analytics = useQuery({ queryKey: ["adminAnalytics"], queryFn: api.adminAnalytics, enabled: isAdmin });
  if (q.isLoading) return <Spinner />;
  const d = q.data;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Circular GMV" value={`$${d.circular_gmv}`} accent="text-leaf-400" />
        <Stat label="CO₂ saved" value={`${d.esg.carbon_saved_kg} kg`} accent="text-leaf-400" />
        <Stat label="Waste diverted" value={`${d.esg.waste_diverted_kg} kg`} />
        <Stat label="Diversion rate" value={`${d.diversion_rate_pct}%`} sub={`${d.circular_returns}/${d.total_returns} returns`} />
      </div>
      <div className="card">
        <h3 className="mb-3 font-bold text-white">Carbon saved by month (platform)</h3>
        {d.carbon_by_month.length === 0 ? <p className="text-sm text-slate-400">No carbon events yet.</p> : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={d.carbon_by_month}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={tip} />
              <Area type="monotone" dataKey="carbon" stroke="#22c55e" fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      {isAdmin && analytics.data && (
        <div className="card">
          <h3 className="mb-3 font-bold text-white">Platform analytics (admin)</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Users" value={analytics.data.users} />
            <Stat label="Orders" value={analytics.data.orders} />
            <Stat label="AI calls" value={analytics.data.ai_calls} sub={`${analytics.data.ai_real} real`} />
            <Stat label="Listings" value={analytics.data.listings} />
          </div>
        </div>
      )}
    </>
  );
}
