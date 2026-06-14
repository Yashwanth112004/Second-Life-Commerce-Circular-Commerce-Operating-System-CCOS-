import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { api } from "./api.js";
import { useAuth } from "./auth.jsx";

const ACTION_STYLE = {
  sell_now: "bg-leaf-500/20 text-leaf-400",
  donate: "bg-sky-500/20 text-sky-300",
  repair: "bg-amber-400/20 text-amber-300",
  hold: "bg-white/10 text-slate-400",
};

// Platform-wide proactive AI assistant. Renders for any logged-in user, persistently.
export default function Concierge() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const c = useQuery({
    queryKey: ["concierge"],
    queryFn: api.concierge,
    enabled: !!user,
    refetchInterval: 60000,
  });

  const listIt = useMutation({
    mutationFn: (orderId) => api.araList(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["concierge"] });
      qc.invalidateQueries({ queryKey: ["conciergeActivity"] });
      qc.invalidateQueries({ queryKey: ["araSuggestions"] });
    },
  });

  if (!user || !c.data) return null;
  const d = c.data;
  const s = d.summary || {};
  const recs = (d.recommendations || []).filter((r) => r && r.action !== "hold");

  return (
    <div className="sticky top-[57px] z-30 border-b border-leaf-500/20 bg-gradient-to-r from-leaf-900/40 via-ink-900/80 to-ink-900/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-5">
        <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 py-2.5 text-left">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-leaf-500 text-ink-950">✦</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-slate-200">
              <span className="font-semibold text-leaf-400">Circular Concierge</span>
              <span className="text-slate-400"> · </span>
              {d.headline}
            </div>
          </div>
          {(s.actionable ?? 0) > 0 && (
            <span className="hidden shrink-0 items-center gap-2 sm:flex">
              <span className="pill bg-leaf-500/20 text-leaf-400">₹{s.total_value_recovery_usd ?? 0}</span>
              <span className="pill bg-sky-500/15 text-sky-300">{s.total_carbon_opportunity_kg ?? 0} kg CO₂</span>
            </span>
          )}
          <span className="shrink-0 text-slate-400">{open ? "▲" : "▼"}</span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="pb-4">
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MiniStat label="Value recovery" value={`₹${s.total_value_recovery_usd ?? 0}`} />
                  <MiniStat label="Carbon opportunity" value={`${s.total_carbon_opportunity_kg ?? 0} kg`} />
                  <MiniStat label="Green Credits" value={`+${s.total_gc_opportunity ?? 0}`} />
                  <MiniStat label="Circular Score" value={`+${s.total_circular_score_opportunity ?? 0}`} />
                </div>

                {recs.length === 0 ? (
                  <div className="rounded-lg bg-white/5 p-3 text-sm text-slate-400">Everything is optimal — I'll keep watching the market and alert you.</div>
                ) : (
                  <div className="space-y-2">
                    {recs.slice(0, 4).map((r) => (
                      <div key={r.order_id} className="rounded-lg bg-white/5 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span>{r.icon}</span>
                            <span className="font-semibold text-white">{r.headline}</span>
                            <span className={`pill text-xs ${ACTION_STYLE[r.action] || ""}`}>{Math.round((r.confidence || 0) * 100)}% confident</span>
                            {r.is_eol && (
                              <span className="pill bg-rose-500/20 text-rose-300 animate-pulse flex items-center gap-1 border border-rose-500/30">
                                ⚠️ EOL Alert
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">+₹{r.impact?.value_recovery_usd ?? 0} · {r.impact?.carbon_opportunity_kg ?? 0}kg · +{r.impact?.green_credits_opportunity ?? 0}GC</span>
                            <button onClick={() => setExpanded(expanded === r.order_id ? null : r.order_id)} className="text-xs text-leaf-400">Why?</button>
                            {r.action === "sell_now" && (
                              <button onClick={() => listIt.mutate(r.order_id)} disabled={listIt.isPending} className="btn-primary px-3 py-1 text-xs">
                                {listIt.isPending ? "…" : "List it"}
                              </button>
                            )}
                            <Link to={`/passport/${r.order_id}`} className="btn-ghost px-3 py-1 text-xs">Passport</Link>
                          </div>
                        </div>
                        <AnimatePresence>
                          {expanded === r.order_id && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 border-t border-white/5 pt-2">
                              <div className="text-xs text-slate-400">{r.summary}</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(r.reasons || []).map((x, j) => (
                                  <span key={j} className={`pill text-xs ${x.weight === "high" ? "bg-leaf-500/10 text-leaf-400" : "bg-white/5 text-slate-400"}`}>
                                    {x.factor}: {x.detail}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-2 text-xs text-slate-500">
                                Twin: ₹{r.twin?.current_value ?? 0} now → ₹{r.twin?.forecast?.m6 ?? 0} in 6mo · best window: {r.twin?.best_resale_window ?? ""} · CES {r.impact?.ces_score ?? 0}/100
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                )}
                {listIt.isSuccess && listIt.data && (
                  <div className="mt-2 rounded-lg bg-leaf-500/10 p-2 text-xs text-leaf-300">
                    ✓ Agent listed "{listIt.data.listing?.title}" at ₹{listIt.data.listing?.price} with {listIt.data.buyer_matches?.matches?.length ?? 0} buyer matches. <Link to="/agent" className="underline">View agent →</Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2">
      <div className="text-lg font-bold text-leaf-400">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
