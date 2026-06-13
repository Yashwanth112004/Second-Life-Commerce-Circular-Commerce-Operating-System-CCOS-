import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api.js";
import { GradeBadge, Spinner, Stat } from "../components.jsx";

const tip = { background: "#0f1420", border: "1px solid #ffffff22", borderRadius: 12 };

export default function Passport() {
  const { orderId } = useParams();
  const q = useQuery({ queryKey: ["passport", orderId], queryFn: () => api.passport(orderId) });

  if (q.isLoading) return <Spinner label="Loading Digital Product Passport…" />;
  if (q.isError) return <div className="card border-rose-500/40 text-rose-300">⚠ Passport not found.</div>;
  const d = q.data;
  const p = d.order;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className="pill bg-leaf-500/15 text-leaf-400">Digital Product Passport</span>
        <span>{p.order_number}</span>
      </div>

      <div className="card flex flex-wrap items-center gap-5">
        <img src={p.image_url} alt="" className="h-24 w-24 rounded-xl object-cover" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-white">{p.brand} {p.title}</h1>
          <div className="mt-1 text-sm text-slate-400">{p.category} · MSRP ${p.msrp} · eco score {p.eco_score}/100</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {d.current_grade && <GradeBadge grade={d.current_grade} label={d.grade_label} />}
            <span className="text-sm text-slate-400">embedded carbon {p.embedded_carbon_kg} kg CO₂</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Lifecycle score" value={`${d.lifecycle_score}/100`} accent="text-leaf-400" />
        <Stat label="Owners" value={d.ownership_count} />
        <Stat label="Repairs" value={d.repair_count} />
        <Stat label="CO₂ saved (item)" value={`${d.total_carbon_saved_kg} kg`} accent="text-leaf-400" />
      </div>

      {/* Circular Economy Score (CES) */}
      {d.ces && (
        <div className="card">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">🌐 Circular Economy Score</h3>
            <span className="text-3xl font-extrabold text-leaf-400">{d.ces.score}/100</span>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
            {Object.entries(d.ces.breakdown).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/5 p-2">
                <div className="text-lg font-bold text-white">{Math.round(v)}</div>
                <div className="text-slate-400 capitalize">{k.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-leaf-500 transition-all" style={{ width: `${d.ces.score}%` }} />
          </div>
        </div>
      )}

      {/* Product Twin */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">🔮 Product Twin — value forecast</h3>
            <span className="pill bg-leaf-500/15 text-leaf-400">best window: {d.twin.best_resale_window}</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{d.twin.recommendation}</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={d.twin.curve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickFormatter={(m) => `${m}mo`} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={tip} formatter={(v) => [`$${v}`, "value"]} />
              <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded bg-white/5 p-2"><div className="font-bold text-white">${d.twin.current_value}</div><div className="text-xs text-slate-400">now</div></div>
            <div className="rounded bg-white/5 p-2"><div className="font-bold text-white">${d.twin.forecast.m6}</div><div className="text-xs text-slate-400">+6 mo</div></div>
            <div className="rounded bg-white/5 p-2"><div className="font-bold text-white">${d.twin.forecast.m12}</div><div className="text-xs text-slate-400">+12 mo</div></div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold text-white">📉 Value history</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={d.value_history}>
              <defs>
                <linearGradient id="vh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={tip} formatter={(v) => [`$${v}`, "value"]} />
              <Area type="monotone" dataKey="value" stroke="#38bdf8" fill="url(#vh)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Buyer Match Engine (NBOE) */}
      {d.buyer_matches && d.buyer_matches.matches && d.buyer_matches.matches.length > 0 && (
        <div className="card space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white">🎯 AI Buyer Match Engine (NBOE)</h3>
            <p className="text-xs text-slate-400 font-medium">Instantly matching circular inventory to prospective buyers. Proximity routing: <b className="text-leaf-400 capitalize">{d.buyer_matches.routing.replace("_", " ")}</b></p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.buyer_matches.matches.slice(0, 3).map((m, i) => (
              <div key={i} className="rounded-xl bg-white/5 p-4 border border-white/5 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{m.buyer_label}</span>
                    <span className="pill text-[10px] bg-leaf-500/20 text-leaf-400 px-1.5 py-0.5 rounded-full">{m.match_score}% Match</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">📍 {m.location} · {m.distance_miles} miles</div>
                  <div className="text-xs text-slate-300 mt-2 italic">"{m.outreachSuggestion}"</div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-white/5 pt-2">
                  <span>⚡ Prob: {m.purchaseProbability}%</span>
                  <span>⏱ Sale: ~{m.predicted_days_to_sale} days</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inspection */}
      {d.inspection && (
        <div className="card">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">🔍 Latest AI inspection</h3>
            <span className="text-xs text-slate-500">model: {d.inspection.model || "n/a"}</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Grade {d.inspection.grade} · {Math.round(Number(d.inspection.confidence) * 100)}% confidence
          </p>
        </div>
      )}

      {/* Story Mode timeline */}
      <div className="card">
        <h2 className="mb-1 text-lg font-bold text-white">📖 Second Life Journey</h2>
        <p className="mb-4 text-sm text-slate-400">The complete story of this item — automatically generated from its lifecycle.</p>
        <ol className="relative border-l border-white/10 pl-6">
          {d.story.map((e, i) => (
            <li key={i} className="mb-6 last:mb-0">
              <span className="absolute -left-3 grid h-6 w-6 place-items-center rounded-full bg-ink-900 text-sm">{e.icon}</span>
              <div className="font-semibold text-white">{e.title}</div>
              <div className="text-xs text-slate-500">{new Date(e.date).toLocaleDateString()} · {e.actor}</div>
              {e.detail && Object.keys(e.detail).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {Object.entries(e.detail).map(([k, v]) => (
                    <span key={k} className="pill bg-white/5 text-slate-300">{k}: {String(v)}</span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
        {d.total_carbon_saved_kg > 0 && (
          <div className="mt-2 rounded-lg bg-leaf-500/10 p-3 text-leaf-400">
            🌍 This item has saved {d.total_carbon_saved_kg} kg CO₂ by staying in circulation.
          </div>
        )}
      </div>
    </div>
  );
}
