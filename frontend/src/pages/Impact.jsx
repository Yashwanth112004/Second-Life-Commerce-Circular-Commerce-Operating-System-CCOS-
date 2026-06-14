import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../api.js";
import { GradeBadge, Spinner } from "../components.jsx";

function Big({ value, label, sub }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card text-center">
      <div className="text-4xl font-extrabold text-leaf-400">{value}</div>
      <div className="mt-1 text-sm text-white">{label}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </motion.div>
  );
}

export default function Impact() {
  const q = useQuery({ queryKey: ["impact"], queryFn: api.impact, refetchInterval: 15000 });
  if (q.isLoading) return <Spinner label="Loading platform impact…" />;
  if (q.isError) return <div className="card border-rose-500/40 text-rose-300">⚠ Could not load impact.</div>;
  const d = q.data || {};
  const totals = d.totals || {};
  const equivalents = d.equivalents || {};
  const secondLifeBreakdown = d.second_life_breakdown || {};
  const topCircularUsers = d.top_circular_users || [];
  const liveInspections = d.live_inspections || [];
  const recentActivity = d.recent_activity || [];
  const mostImpactfulProduct = d.most_impactful_product || null;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <span className="pill border border-leaf-500/40 bg-leaf-500/10 text-leaf-400">Live platform impact</span>
        <h1 className="mt-4 text-4xl font-extrabold text-white">The circular economy, in real time.</h1>
        <p className="mt-2 text-slate-400">Every metric below is computed from real transactions on the platform.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Big value={`${Math.round(totals.carbon_saved_kg || 0)} kg`} label="CO₂ saved" sub={equivalents.driving ?? ""} />
        <Big value={`${Math.round(totals.water_saved_l || 0)} L`} label="Water saved" />
        <Big value={`${Math.round(totals.waste_diverted_kg || 0)} kg`} label="Waste diverted" />
        <Big value={d.products_given_second_life ?? 0} label="Products given a second life" sub={`${secondLifeBreakdown.resold ?? 0} resold · ${secondLifeBreakdown.donated ?? 0} donated`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-lg font-bold text-white">🏆 Top circular users</h2>
          {topCircularUsers.length === 0 ? (
            <p className="text-sm text-slate-400">No activity yet.</p>
          ) : topCircularUsers.map((u) => (
            <div key={u.rank} className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
              <span className="text-white">#{u.rank} {u.name} <span className="text-slate-500">· {u.city}</span></span>
              <span className="pill bg-leaf-500/20 text-leaf-400">{u.score} · {u.tier}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h2 className="mb-3 text-lg font-bold text-white">🔍 Live AI inspections</h2>
          {liveInspections.length === 0 ? (
            <p className="text-sm text-slate-400">No inspections yet — run a return to see Qwen-VL grade an item.</p>
          ) : liveInspections.map((i, k) => (
            <div key={k} className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
              <span className="text-slate-300">{i.product} <span className="text-slate-500">· {i.model}</span></span>
              <span className="flex items-center gap-2"><GradeBadge grade={i.grade} /> <span className="text-slate-500">{Math.round(i.confidence * 100)}%</span></span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-bold text-white">⚡ Recent circular activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-slate-400">No activity yet.</p>
        ) : recentActivity.map((a, k) => (
          <div key={k} className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
            <span className="text-slate-300"><b className="capitalize text-white">{a.action}</b> · {a.product} <span className="text-slate-500">by {a.user}, {a.city}</span></span>
            <span className="text-leaf-400">{a.carbon_saved_kg} kg CO₂</span>
          </div>
        ))}
      </div>

      {mostImpactfulProduct && (
        <div className="card flex items-center gap-4">
          <img src={mostImpactfulProduct.image_url} alt="" className="h-16 w-16 rounded-lg object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Most impactful product</div>
            <div className="font-bold text-white">{mostImpactfulProduct.brand} {mostImpactfulProduct.title}</div>
            <div className="text-sm text-leaf-400">{Math.round(Number(mostImpactfulProduct.carbon || 0))} kg CO₂ saved</div>
          </div>
        </div>
      )}
    </div>
  );
}
