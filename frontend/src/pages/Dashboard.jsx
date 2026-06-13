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
  const eolOrderIds = new Set(
    ara.data?.suggestions?.filter((x) => x.is_eol).map((x) => x.order_id) || []
  );

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
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">est ${o.estimated_value} · {o.status}</span>
                    {eolOrderIds.has(o.id) && (
                      <span className="pill text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/20 animate-pulse">⚠️ EOL Alert</span>
                    )}
                  </div>
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

      {/* Donation Impact Summary */}
      {d.donations && (
        <div className="card space-y-3">
          <h3 className="font-bold text-white">🎁 Donation Impact & Social Utility</h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <div className="text-xl font-bold text-leaf-400">{d.donations.items_donated}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Items Donated</div>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <div className="text-xl font-bold text-leaf-400">{d.donations.people_impacted}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">People Impacted</div>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <div className="text-xl font-bold text-leaf-400">${d.donations.total_value}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Donated Value (FMV)</div>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <div className="text-xl font-bold text-leaf-400">${d.donations.tax_benefits}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Tax Benefits Saved</div>
            </div>
          </div>
        </div>
      )}

      {/* Packaging Intelligence Summary */}
      {d.packaging && (
        <div className="card space-y-3">
          <h3 className="font-bold text-white">📦 Packaging Assessment Circularity</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <div className="text-xl font-bold text-leaf-400">{d.packaging.reused}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Original Boxes Reused</div>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <div className="text-xl font-bold text-leaf-400">{d.packaging.recycled}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Boxes Recycled</div>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <div className="text-xl font-bold text-leaf-400">{d.packaging.waste_avoided_kg} kg</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Packaging Waste Diverted</div>
            </div>
          </div>
        </div>
      )}

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
        <div className="space-y-6">
          <div className="card">
            <h3 className="mb-3 font-bold text-white">Platform analytics (admin)</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Users" value={analytics.data.users} />
              <Stat label="Orders" value={analytics.data.orders} />
              <Stat label="AI calls" value={analytics.data.ai_calls} sub={`${analytics.data.ai_real} real`} />
              <Stat label="Listings" value={analytics.data.listings} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Return Risk Distribution */}
            <div className="card space-y-3">
              <h3 className="font-bold text-white">♺ Return Risk Distribution</h3>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {analytics.data.risk_distribution && analytics.data.risk_distribution.length > 0 ? (
                  analytics.data.risk_distribution.map((r) => (
                    <div key={r.risk_level} className="rounded-lg bg-white/5 p-3">
                      <div className={`text-xl font-bold ${
                        r.risk_level === "HIGH" ? "text-rose-400" : r.risk_level === "MEDIUM" ? "text-amber-400" : "text-emerald-400"
                      }`}>{r.count}</div>
                      <div className="text-slate-500 uppercase tracking-wider text-[9px]">{r.risk_level} Risk</div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 text-slate-500 py-3">No return intent predictions logged yet.</div>
                )}
              </div>
            </div>

            {/* Categories with Highest Risk */}
            <div className="card space-y-3">
              <h3 className="font-bold text-white">🏷 Return Risk by Category</h3>
              <div className="space-y-2">
                {analytics.data.category_risk && analytics.data.category_risk.length > 0 ? (
                  analytics.data.category_risk.map((c) => (
                    <div key={c.category} className="flex items-center justify-between text-xs rounded-lg bg-white/5 px-3 py-2">
                      <span className="text-slate-300 capitalize">{c.category}</span>
                      <span className="font-bold text-amber-300">{c.avg_probability}% risk</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 py-2 text-center text-xs">No return intent predictions on file.</div>
                )}
              </div>
            </div>
          </div>

          {/* Products causing future returns */}
          {analytics.data.product_risk && analytics.data.product_risk.length > 0 && (
            <div className="card">
              <h3 className="mb-3 font-bold text-white">⚠️ Top Products Flagged for Future Returns</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2">Product ID</th>
                      <th className="py-2">Brand</th>
                      <th className="py-2">Category</th>
                      <th className="py-2 text-right">Avg Risk Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.data.product_risk.map((p) => (
                      <tr key={p.product_id} className="border-b border-white/5 text-slate-300 hover:bg-white/5">
                        <td className="py-2 font-mono text-[10px]">{p.product_id}</td>
                        <td className="py-2">{p.brand}</td>
                        <td className="py-2 capitalize">{p.category}</td>
                        <td className="py-2 text-right font-bold text-rose-400">{p.avg_probability}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
