import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api.js";
import { Spinner, Stat } from "../components.jsx";

const COLORS = ["#22c55e", "#38bdf8", "#a78bfa", "#f59e0b", "#fb7185"];

export default function Wallet() {
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: api.wallet });
  const history = useQuery({ queryKey: ["walletHistory"], queryFn: api.walletHistory });
  const carbon = useQuery({ queryKey: ["carbonReport"], queryFn: api.carbonReport });

  if (wallet.isLoading || carbon.isLoading) return <Spinner label="Loading your circular wallet…" />;
  const w = wallet.data;
  const c = carbon.data;
  const next = w.next_level;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-white">Circular Wallet & Impact</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Green Credits" value={`${w.green_credits} GC`} sub={`$${w.cash_value_usd} value`} accent="text-leaf-400" />
        <Stat label="CO₂ saved" value={`${w.carbon_saved_kg} kg`} sub={c.equivalents.driving} accent="text-leaf-400" />
        <Stat label="Water saved" value={`${w.water_saved_l} L`} />
        <Stat label="Level" value={w.level} sub={next.name ? `${next.gcToNext} GC to ${next.name}` : "Max level"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 font-bold text-white">CO₂ saved over time</h3>
          {c.timeline.length === 0 ? (
            <p className="text-sm text-slate-400">No activity yet — resell or donate an item to start saving.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={c.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: "#0f1420", border: "1px solid #ffffff22", borderRadius: 12 }} />
                <Bar dataKey="carbon" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="mb-3 font-bold text-white">Savings by action</h3>
          {c.by_action.length === 0 ? (
            <p className="text-sm text-slate-400">No circular actions recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={c.by_action} dataKey="carbon" nameKey="action" outerRadius={90} label>
                  {c.by_action.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f1420", border: "1px solid #ffffff22", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 font-bold text-white">Green Credit ledger</h3>
        {history.data && history.data.length > 0 ? (
          <div className="divide-y divide-white/5">
            {history.data.map((e, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-300">{e.reason}</span>
                <div className="flex items-center gap-4">
                  <span className={e.delta >= 0 ? "text-leaf-400" : "text-rose-300"}>{e.delta >= 0 ? "+" : ""}{e.delta} GC</span>
                  <span className="text-slate-500">bal {e.balance_after}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No transactions yet.</p>
        )}
      </div>
    </div>
  );
}
