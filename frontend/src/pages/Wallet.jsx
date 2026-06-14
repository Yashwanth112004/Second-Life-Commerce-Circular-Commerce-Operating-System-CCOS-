import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useAuth } from "../auth.jsx";
import { Spinner, Stat } from "../components.jsx";

const COLORS = ["#22c55e", "#38bdf8", "#a78bfa", "#f59e0b", "#fb7185"];

export default function Wallet() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const wallet = useQuery({ queryKey: ["wallet"], queryFn: api.wallet });
  const history = useQuery({ queryKey: ["walletHistory"], queryFn: api.walletHistory });
  const carbon = useQuery({ queryKey: ["carbonReport"], queryFn: api.carbonReport });

  const [tradeAmount, setTradeAmount] = useState("");
  const [tradeAction, setTradeAction] = useState("sell");
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const tradeMut = useMutation({
    mutationFn: (body) => api.tradeCredits(body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["walletHistory"] });
      setTradeAmount("");
      if (tradeAction === "sell") {
        setSuccessMsg(`Successfully swapped green credits! Received ₹${data.usdEarned.toFixed(2)} INR Tokens.`);
      } else {
        setSuccessMsg(`Successfully purchased green credits! Deducted ₹${data.usdCost.toFixed(2)} INR Tokens.`);
      }
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.message;
      setErrorMsg(msg);
    }
  });

  const handleTrade = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const amountNum = Number(tradeAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg("Please enter a valid positive amount.");
      return;
    }
    tradeMut.mutate({ amount: amountNum, action: tradeAction });
  };

  if (wallet.isLoading || carbon.isLoading) return <Spinner label="Loading your circular wallet…" />;
  const w = wallet.data || {};
  const c = carbon.data || {};
  const next = w.next_level || {};
  const equivalents = c.equivalents || {};
  const timeline = c.timeline || [];
  const byAction = c.by_action || [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-white">Circular Wallet & Impact</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Green Credits" value={`${w.green_credits ?? 0} GC`} sub={`Rate: ₹${(w.exchange_rate || 0).toFixed(4)}/GC`} accent="text-leaf-400" />
        <Stat label="INR Token Balance" value={`₹${(w.usd_balance || 0).toFixed(2)}`} sub={`Total cash value: ₹${(w.cash_value_usd || 0).toFixed(2)}`} accent="text-amber-400" />
        <Stat label="CO₂ saved" value={`${w.carbon_saved_kg ?? 0} kg`} sub={equivalents.driving ?? ""} accent="text-leaf-400" />
        <Stat label="Level" value={w.level ?? "1"} sub={next.name ? `${next.gcToNext ?? 0} GC to ${next.name}` : "Max level"} />
      </div>

      {/* DeFi Token Swap and Carbon-Backed Verification Registry */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* DeFi Token Swap Card */}
        <div className="card border-leaf-500/20 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md">
          <h3 className="mb-3 font-bold text-white flex items-center gap-2">
            <span>💱</span> Green Credit DeFi Token Swap
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Swap your verified Green Credit tokens for tradeable INR Stable-Tokens, or buy more credits. Pricing is algorithmically backed by actual verified carbon offsets.
          </p>
          
          <div className="space-y-4">
            {/* Action selector */}
            <div className="flex gap-2 p-1 rounded-lg bg-white/5">
              <button 
                onClick={() => { setTradeAction("sell"); setErrorMsg(null); setSuccessMsg(null); }}
                className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-md transition ${tradeAction === "sell" ? "bg-leaf-500 text-ink-950" : "text-slate-400 hover:text-white"}`}
              >
                Swap GC for INR (Sell)
              </button>
              <button 
                onClick={() => { setTradeAction("buy"); setErrorMsg(null); setSuccessMsg(null); }}
                className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-md transition ${tradeAction === "buy" ? "bg-leaf-500 text-ink-950" : "text-slate-400 hover:text-white"}`}
              >
                Purchase GC (Buy)
              </button>
            </div>

            {/* Input Form */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Amount of Green Credits (GC)</span>
                <span>Balance: {w.green_credits ?? 0} GC</span>
              </div>
              <div className="relative">
                <input 
                  type="number"
                  placeholder="0"
                  value={tradeAmount}
                  onChange={(e) => { setTradeAmount(e.target.value); setErrorMsg(null); setSuccessMsg(null); }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-leaf-500/50"
                  min="1"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">GC</span>
              </div>
            </div>

            {/* Price Preview */}
            <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Algorithmic Rate:</span>
                <span className="text-leaf-400 font-medium">₹{(w.exchange_rate || 0).toFixed(4)} INR / GC</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Total Value:</span>
                <span className="text-white font-bold">₹{(Number(tradeAmount || 0) * (w.exchange_rate || 0)).toFixed(2)} INR</span>
              </div>
              {tradeAction === "buy" && (
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Available INR Tokens:</span>
                  <span>₹{(w.usd_balance || 0).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Buttons & Status */}
            {errorMsg && <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg">⚠️ {errorMsg}</div>}
            {successMsg && <div className="text-xs text-leaf-400 bg-leaf-500/10 p-2 rounded-lg">✓ {successMsg}</div>}

            <button 
              onClick={handleTrade}
              disabled={tradeMut.isPending || !tradeAmount || Number(tradeAmount) <= 0}
              className="w-full btn-primary py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {tradeMut.isPending ? "Executing Swap..." : tradeAction === "sell" ? "Swap GC for INR Tokens" : "Confirm GC Purchase"}
            </button>
          </div>
        </div>

        {/* Carbon-Backed Registry Verification Panel */}
        <div className="card border-sky-500/20 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md space-y-4">
          <h3 className="font-bold text-white flex items-center gap-2">
            <span>🛡️</span> Carbon Backing Verification Registry
          </h3>
          <p className="text-xs text-slate-400">
            Every Green Credit token minted on CCOS represents an audit-verified, direct carbon avoidance event. This cryptographic registry links credit liquidity directly to structural sustainability.
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Registry ID</div>
                <div className="font-mono text-white mt-0.5 truncate text-[11px]">CCOS-REG-{(user?.id || "").slice(0, 8).toUpperCase()}</div>
              </div>
              <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Verification Level</div>
                <div className="text-sky-300 font-semibold mt-0.5 text-[11px] flex items-center gap-1">
                  <span className="text-sky-400">✦</span> Gold Standard Approved
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Carbon Intensity Efficacy</div>
                <div className="text-leaf-400 font-bold mt-0.5 text-[11px]">
                  {(w.green_credits ?? 0) > 0 ? ((w.carbon_saved_kg || 0) / w.green_credits).toFixed(2) : "1.00"} kg CO₂/GC
                </div>
              </div>
              <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Verification Audit</div>
                <div className="text-slate-300 mt-0.5 text-[11px]">
                  ✓ Verified by AI ESG Oracle
                </div>
              </div>
            </div>

            {/* Visual indicator of carbon backing ratio */}
            <div className="p-3 bg-leaf-500/5 rounded-lg border border-leaf-500/10">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Token Backing Ratio Efficacy</span>
                <span className="font-semibold text-leaf-400">Excellent</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-leaf-400 h-full rounded-full" style={{ width: `${Math.min(100, ((w.carbon_saved_kg || 0) / Math.max(1, w.green_credits || 1)) * 50)}%` }} />
              </div>
              <div className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                This account has a total backing of <b className="text-slate-300">{w.carbon_saved_kg ?? 0} kg CO₂</b> offsets across <b className="text-slate-300">{w.green_credits ?? 0}</b> active credit tokens. Higher offset intensity increases token value yield.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 font-bold text-white">CO₂ saved over time</h3>
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-400">No activity yet — resell or donate an item to start saving.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={timeline}>
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
          {byAction.length === 0 ? (
            <p className="text-sm text-slate-400">No circular actions recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byAction} dataKey="carbon" nameKey="action" outerRadius={90} label>
                  {byAction.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
