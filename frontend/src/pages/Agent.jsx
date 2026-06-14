import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Spinner } from "../components.jsx";

const ACTION_STYLE = {
  sell_now: "bg-leaf-500/20 text-leaf-400",
  donate: "bg-sky-500/20 text-sky-300",
  hold: "bg-white/10 text-slate-400",
};

const STAGES = [
  { id: "rip", label: "Analyzing Inventory...", description: "Return Intent Predictor running risk diagnostics" },
  { id: "rde", label: "Evaluating Condition...", description: "Refurbishment pathways & circular grade assessment" },
  { id: "nboe", label: "Finding Best Owner...", description: "Next Best Owner Engine matching with high-propensity buyers" },
  { id: "dcpe", label: "Calculating Price...", description: "Dynamic Pricing Engine mapping regional markdown schedules" },
  { id: "lag", label: "Publishing Listing...", description: "Generating listing copy and digital passport update" },
  { id: "repricer", label: "Monitoring Demand...", description: "Activating autonomous auto-repricer loop" }
];

export default function Agent() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["araStatus"], queryFn: api.araStatus });
  const sugg = useQuery({ queryKey: ["araSuggestions"], queryFn: api.araSuggestions });
  const activity = useQuery({ queryKey: ["conciergeActivity"], queryFn: api.conciergeActivity });

  const [activeResale, setActiveResale] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const toggle = useMutation({
    mutationFn: (enabled) => api.araToggle(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["araStatus"] }),
  });
  const listIt = useMutation({
    mutationFn: (orderId) => api.araList(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["araSuggestions"] });
      qc.invalidateQueries({ queryKey: ["conciergeActivity"] });
      qc.invalidateQueries({ queryKey: ["concierge"] });
    },
  });

  const enabled = status.data ? status.data.enabled : false;

  useEffect(() => {
    if (!activeResale) {
      setCurrentStep(0);
      setShowSuccess(false);
      return;
    }

    // Trigger the mutation
    listIt.mutate(activeResale.order_id);

    let step = 0;
    setCurrentStep(0);
    setShowSuccess(false);

    const interval = setInterval(() => {
      step += 1;
      if (step < STAGES.length) {
        setCurrentStep(step);
      } else {
        clearInterval(interval);
      }
    }, 900);

    return () => {
      clearInterval(interval);
    };
  }, [activeResale]);

  useEffect(() => {
    if (activeResale && listIt.isSuccess && currentStep === STAGES.length - 1) {
      const timer = setTimeout(() => {
        setShowSuccess(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [listIt.isSuccess, currentStep, activeResale]);

  return (
    <div className="space-y-6">
      <div>
        <span className="pill border border-amber-400/40 bg-amber-400/10 text-amber-300">⭐ Autonomous Resale Agent</span>
        <h1 className="mt-3 text-3xl font-extrabold text-white">Your closet is a passive income engine.</h1>
        <p className="mt-1 max-w-2xl text-slate-400">
          The agent scans your owned inventory, forecasts each item's value with its Digital Twin, and recommends sell / hold / donate — then lists items for you on approval.
        </p>
      </div>

      <div className="card flex items-center justify-between">
        <div>
          <div className="font-semibold text-white">Auto Resale Agent</div>
          <div className="text-sm text-slate-400">{enabled ? "Enabled — monitoring your inventory." : "Disabled."}</div>
        </div>
        <button onClick={() => toggle.mutate(!enabled)} disabled={toggle.isPending}
          className={`relative h-8 w-14 rounded-full transition ${enabled ? "bg-leaf-500" : "bg-white/15"}`}>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${enabled ? "left-7" : "left-1"}`} />
        </button>
      </div>

      {activity.data && (
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-white">📡 Agent Activity Feed</h3>
            <span className="text-xs text-slate-500">last scan: {activity.data.last_scan ? new Date(activity.data.last_scan).toLocaleTimeString() : ""}</span>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ActStat label="Listings generated" value={activity.data.stats?.listings_generated ?? 0} />
            <ActStat label="Buyer matches found" value={activity.data.stats?.buyer_matches_found ?? 0} />
            <ActStat label="Donations made" value={activity.data.stats?.donations_made ?? 0} />
            <ActStat label="ARA-listed items" value={activity.data.stats?.ara_listings ?? 0} />
          </div>
          <div className="space-y-1">
            {(!activity.data.feed || activity.data.feed.length === 0) ? (
              <div className="text-sm text-slate-400">No activity yet — enable the agent and run a scan.</div>
            ) : activity.data.feed.map((f, i) => (
              <div key={i} className="flex items-center justify-between border-b border-white/5 py-1.5 text-sm last:border-0">
                <span className="text-slate-300"><b className="text-white">{f?.title}</b> {f?.body ? `— ${f.body}` : ""}</span>
                <span className="shrink-0 text-xs text-slate-500">{f?.at ? new Date(f.at).toLocaleDateString() : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {listIt.isSuccess && listIt.data && (
        <div className="card border-leaf-500/40 text-leaf-300">
          ✓ Agent listed "{listIt.data.listing?.title}" at ${listIt.data.listing?.price} with {listIt.data.buyer_matches?.matches?.length ?? 0} buyer matches.
        </div>
      )}

      {sugg.isLoading ? (
        <Spinner label="Agent scanning your inventory…" />
      ) : sugg.data ? (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card border-leaf-500/30 text-center">
            <p className="text-lg text-white">{sugg.data.headline}</p>
          </motion.div>
          <div className="space-y-3">
            {(sugg.data.suggestions || []).map((s, i) => (
              <motion.div key={s.order_id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="card flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img src={s.product?.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-white">{s.product?.title}</div>
                      {s.is_eol && (
                        <span className="pill text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/20 animate-pulse">⚠️ EOL Alert</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">{s.reason}</div>
                    <Link to={`/passport/${s.order_id}`} className="text-xs text-leaf-400">View passport & twin →</Link>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-extrabold text-leaf-400">${s.estimated_value ?? 0}</div>
                    <div className="text-xs text-slate-500">+{s.projected_gc ?? 0} GC · {s.projected_carbon_kg ?? 0} kg</div>
                  </div>
                  <span className={`pill capitalize ${ACTION_STYLE[s.action]}`}>{s.action?.replace("_", " ")}</span>
                  {s.action === "sell_now" && (
                    <button onClick={() => setActiveResale(s)}
                      className="btn-primary py-2 text-sm">List it now</button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      ) : null}

      {/* Resale Optimization Modal */}
      <AnimatePresence>
        {activeResale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-6 overflow-hidden max-h-[90vh] flex flex-col"
            >
              {!showSuccess ? (
                // Step Progress View
                <div className="space-y-6 flex-1 flex flex-col justify-between overflow-y-auto">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-white">Autonomous Resale Loop</h3>
                      <span className="pill border border-amber-400/40 bg-amber-400/10 text-amber-300">
                        ⚡ ARA Active
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Processing digital twin metrics for <span className="text-slate-300 font-semibold">{activeResale.product?.title}</span>.
                    </p>
                  </div>

                  {/* Steps list */}
                  <div className="space-y-4 py-2">
                    {STAGES.map((stage, idx) => {
                      const isCompleted = idx < currentStep;
                      const isCurrent = idx === currentStep;
                      const isPending = idx > currentStep;

                      let statusColor = "text-slate-500 border-white/10 bg-white/5";
                      let indicator = <div className="h-2 w-2 rounded-full bg-slate-600" />;

                      if (isCompleted) {
                        statusColor = "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
                        indicator = (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="font-bold text-xs"
                          >
                            ✓
                          </motion.span>
                        );
                      } else if (isCurrent) {
                        if (listIt.isError) {
                          statusColor = "text-rose-400 border-rose-500/20 bg-rose-500/5";
                          indicator = <span className="font-bold text-xs">✗</span>;
                        } else {
                          statusColor = "text-leaf-400 border-leaf-500/20 bg-leaf-500/5";
                          indicator = (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-leaf-500 border-t-transparent" />
                          );
                        }
                      }

                      return (
                        <div
                          key={stage.id}
                          className={`flex items-start gap-4 rounded-xl border p-3.5 transition-all duration-300 ${
                            isCurrent
                              ? "bg-white/5 border-white/15 scale-[1.02] shadow-md"
                              : "border-transparent opacity-60"
                          }`}
                        >
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${statusColor}`}
                          >
                            {indicator}
                          </div>
                          <div className="space-y-0.5">
                            <div
                              className={`text-sm font-semibold transition-colors ${
                                isCurrent
                                  ? "text-white font-bold"
                                  : isCompleted
                                  ? "text-slate-300"
                                  : "text-slate-500"
                              }`}
                            >
                              {stage.label}
                            </div>
                            <div className="text-xs text-slate-400">{stage.description}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {listIt.isError && (
                    <div className="card border-rose-500/30 bg-rose-500/5 p-4 text-xs text-rose-300 space-y-2">
                      <div className="font-bold">Optimization Failed</div>
                      <div>{readErr(listIt.error)}</div>
                      <button
                        onClick={() => {
                          listIt.reset();
                          setActiveResale(null);
                        }}
                        className="btn-ghost w-full py-2 text-xs"
                      >
                        Close Window
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                // Success View
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6 flex-1 flex flex-col overflow-y-auto"
                >
                  <div className="text-center space-y-2">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="text-xl font-bold">✓</span>
                    </div>
                    <h3 className="text-xl font-bold text-white">Listing Active & Protected!</h3>
                    <p className="text-xs text-slate-400">
                      Autonomous optimization sequence completed successfully.
                    </p>
                  </div>

                  {/* Compact Digital Twin Listing Card */}
                  <div className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
                    <img
                      src={activeResale.product?.image_url}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover border border-white/10 shrink-0"
                    />
                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="font-semibold text-white truncate text-sm">
                          {activeResale.product?.title}
                        </div>
                        <div className="text-xs text-slate-400">
                          MSRP: ${activeResale.product?.msrp} · Size: {listIt.data?.listing?.size || activeResale.product?.size || "M"}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-leaf-400 font-extrabold text-lg">
                          ${listIt.data?.listing?.price}
                        </div>
                        <div className="pill border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[10px]">
                          Expected Sale: {listIt.data?.pricing?.expected_sale_time_days || 5} Days
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Grid of Applied Engines */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-white/5 bg-white/5/30 rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                        1. Return Predictor (RIP)
                      </span>
                      <div className="text-xs font-semibold text-white">
                        {listIt.data?.rip?.riskLevel || "LOW"} Risk ({listIt.data?.rip?.returnProbability || 15}%)
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Evaluated seller retention & category risk factors.
                      </p>
                    </div>

                    <div className="border border-white/5 bg-white/5/30 rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                        2. Condition Matrix (RDE)
                      </span>
                      <div className="text-xs font-semibold text-white">
                        Grade {listIt.data?.listing?.condition_grade || "B"} · Resell
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Optimum route generated: As-Is certified preloved.
                      </p>
                    </div>

                    <div className="border border-white/5 bg-white/5/30 rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                        3. Pricing Schedule (DCPE)
                      </span>
                      <div className="text-xs font-semibold text-white">
                        {listIt.data?.pricing?.markdown_schedule?.length || 4} Markdown Steps
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Confidence: {listIt.data?.pricing?.price_confidence || 85}% · Floor: ${listIt.data?.pricing?.price_floor || Math.round((listIt.data?.listing?.price || 1) * 0.88)}
                      </p>
                    </div>

                    <div className="border border-white/5 bg-white/5/30 rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                        4. Best Owner (NBOE)
                      </span>
                      <div className="text-xs font-semibold text-white">
                        {listIt.data?.buyer_matches?.matches?.length || 0} Target Buyers
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Outreach queued for top fit ({listIt.data?.buyer_matches?.matches?.[0]?.match_score || 92}% matching score).
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        listIt.reset();
                        setActiveResale(null);
                      }}
                      className="btn-primary w-full py-2.5 text-sm"
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function ActStat({ label, value }) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
      <div className="text-xl font-bold text-leaf-400">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function readErr(e) {
  if (e.response && e.response.data && e.response.data.error) return e.response.data.error;
  return e.message;
}
