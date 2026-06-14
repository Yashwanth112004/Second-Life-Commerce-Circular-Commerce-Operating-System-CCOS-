import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { GradeBadge, Spinner } from "../components.jsx";

const CATEGORIES = ["", "electronics", "apparel", "home"];
const SORTS = [
  ["newest", "Newest"],
  ["price_asc", "Price: low→high"],
  ["price_desc", "Price: high→low"],
  ["popular", "Most viewed"],
];

const GAUGE_COLORS = {
  LOW: "bg-emerald-500 text-emerald-400 border-emerald-500/20",
  MEDIUM: "bg-amber-500 text-amber-400 border-amber-500/20",
  HIGH: "bg-rose-500 text-rose-400 border-rose-500/20",
};

export default function Marketplace() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ q: "", category: "", sort: "newest", page: 1 });
  const [selectedListing, setSelectedListing] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loadingPredict, setLoadingPredict] = useState(false);
  const [sizeAdvice, setSizeAdvice] = useState(null);
  const [loadingSize, setLoadingSize] = useState(false);
  const [pageMountTime] = useState(Date.now());

  const set = (k, v) => setFilters({ ...filters, [k]: v, page: k === "page" ? v : 1 });

  const channels = useQuery({ queryKey: ["channels"], queryFn: api.channels });
  const search = useQuery({
    queryKey: ["search", filters],
    queryFn: () => api.search({ ...filters, pageSize: 9 }),
  });

  const buy = useMutation({
    mutationFn: (id) => api.buy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["search"] });
      setSelectedListing(null);
      setPrediction(null);
      setSizeAdvice(null);
    },
  });

  const handleBuyClick = (listing) => {
    setSelectedListing(listing);
    setLoadingPredict(true);
    setPrediction(null);
    setLoadingSize(true);
    setSizeAdvice(null);
 
    // Track behavioral signals for Return Intent Predictor (RIP)
    const timeSpentSec = Math.round((Date.now() - pageMountTime) / 1000);
    const mockBehavior = {
      timeOnPage: Math.min(300, timeSpentSec || 25),
      imagesViewed: 3,
      questionsAsked: 0,
      productComparisons: 2,
      sessionDuration: Math.min(600, timeSpentSec + 120)
    };
 
    const mockContext = {
      season: "Summer",
      day: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date()),
      deviceType: window.innerWidth < 768 ? "mobile" : "desktop"
    };
 
    api.predictReturn(listing.id, { behavior: mockBehavior, context: mockContext })
      .then((data) => {
        setPrediction(data);
        setLoadingPredict(false);
      })
      .catch((err) => {
        console.error("Predict return failed:", err);
        setLoadingPredict(false);
      });

    api.sizeAdvice(listing.id)
      .then((data) => {
        setSizeAdvice(data);
        setLoadingSize(false);
      })
      .catch((err) => {
        console.error("Size advice failed:", err);
        setLoadingSize(false);
      });
  };

  const data = search.data || {};
  const totalPages = data.page_size ? Math.max(1, Math.ceil((data.total || 0) / data.page_size)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Circular Marketplace</h1>
        <p className="mt-1 text-slate-400">Six interconnected channels, one shared trust + logistics layer.</p>
      </div>

      {channels.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {channels.data.map((c) => (
            <div key={c.id} className="card py-4">
              <div className="font-semibold text-leaf-400">{c.name}</div>
              <div className="mt-1 text-sm text-slate-400">{c.desc}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card flex flex-wrap items-center gap-3">
        <input value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Search…"
          className="flex-1 rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-white outline-none focus:border-leaf-500" />
        <select value={filters.category} onChange={(e) => set("category", e.target.value)}
          className="rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-white">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c || "All categories"}</option>)}
        </select>
        <select value={filters.sort} onChange={(e) => set("sort", e.target.value)}
          className="rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-white">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {buy.isSuccess && buy.data && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="card border-leaf-500/30 bg-leaf-500/[0.04] text-leaf-300 flex items-center gap-3 py-4"
        >
          <span className="text-xl">🎉</span>
          <div>
            <div className="font-bold text-white text-sm">Purchase Completed Successfully!</div>
            <div className="text-xs text-slate-400 mt-0.5">
              You earned <span className="text-leaf-400 font-semibold">{buy.data.green_credits_earned ?? 0} GC</span> and saved <span className="text-leaf-400 font-semibold">{buy.data.carbon?.carbon_saved_kg ?? 0} kg CO₂</span>.
            </div>
          </div>
        </motion.div>
      )}

      {search.isLoading ? (
        <Spinner label="Searching circular inventory…" />
      ) : (
        <>
          <div className="text-sm text-slate-400">{data.total ?? 0} results</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.results && data.results.map((l) => (
              <div key={l.id} className="card overflow-hidden p-0 flex flex-col justify-between">
                <div>
                  <img src={l.image_url} alt="" className="h-40 w-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = "none")} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-white">{l.title}</div>
                      <GradeBadge grade={l.condition_grade} />
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-leaf-400">₹{l.price ?? 0}</span>
                      <span className="text-sm text-slate-500 line-through">₹{l.msrp ?? 0}</span>
                      <span className="pill bg-leaf-500/20 text-leaf-400">−{l.savings_pct ?? 0}%</span>
                    </div>

                    {/* AI pricing badge */}
                    <div className="mt-2.5 text-[11px] text-leaf-400 flex items-center gap-1 bg-leaf-500/10 border border-leaf-500/20 rounded-lg px-2 py-1">
                      <span>♺</span>
                      <span>AI Price Recommended · expected sale in {l.expected_sale_time_days || 5} days</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>📍 {l.seller_city}</span>
                      <span>★ {Number(l.avg_rating || 0).toFixed(1)} ({l.review_count ?? 0})</span>
                    </div>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  {user && (
                    <button onClick={() => handleBuyClick(l)} disabled={buy.isPending}
                      className="btn-primary mt-1 w-full py-2 text-sm">Buy preloved</button>
                  )}
                  {!user && (
                    <Link to="/login" className="btn-ghost mt-1 block w-full py-2 text-center text-sm">Sign in to buy</Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button disabled={filters.page <= 1} onClick={() => set("page", filters.page - 1)} className="btn-ghost py-2">Prev</button>
              <span className="text-sm text-slate-400">Page {filters.page} / {totalPages}</span>
              <button disabled={filters.page >= totalPages} onClick={() => set("page", filters.page + 1)} className="btn-ghost py-2">Next</button>
            </div>
          )}
        </>
      )}

      {/* Checkout Return Prediction Modal */}
      <AnimatePresence>
        {selectedListing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className={`w-full ${selectedListing?.category === "apparel" ? "max-w-4xl" : "max-w-xl"} rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 to-ink-950 p-6 md:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.6)] space-y-6 backdrop-blur-xl relative overflow-hidden`}
            >
              
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-2xl font-black tracking-tight text-white">Review & Checkout</h3>
                  <p className="text-xs text-slate-400 mt-1">Previewing circular return intent & pricing diagnostics.</p>
                </div>
                <button 
                  onClick={() => { setSelectedListing(null); setPrediction(null); setSizeAdvice(null); }} 
                  className="rounded-full bg-white/5 p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Item Summary */}
              <div className="flex gap-4 rounded-2xl bg-white/[0.03] border border-white/5 p-4 items-center">
                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-white/10">
                  <img src={selectedListing.image_url} alt="" className="h-full w-full object-cover transition-transform duration-500 hover:scale-110" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg text-white truncate">{selectedListing.title}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xl font-black text-leaf-400">₹{selectedListing.price}</span>
                    {selectedListing.msrp && (
                      <span className="text-sm text-slate-500 line-through">₹{selectedListing.msrp}</span>
                    )}
                    <span className="pill py-0.5 px-2.5 bg-leaf-500/10 text-leaf-400 border border-leaf-500/20 text-[10px] rounded-full uppercase tracking-wider font-extrabold">
                      Size {selectedListing.size || "M"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grid Wrapper for Side-by-Side Cards */}
              <div className={selectedListing?.category === "apparel" ? "grid grid-cols-1 md:grid-cols-2 gap-5" : "space-y-6"}>
                {/* RIP Analysis */}
                <div className="border border-white/5 rounded-2xl p-5 bg-gradient-to-tr from-white/[0.01] to-white/[0.03] space-y-4 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-leaf-400 text-lg">📊</span>
                      <span className="text-sm font-bold text-slate-200 tracking-wide">AI Return Risk Assessment</span>
                    </div>
                    {prediction && (
                      <span className={`pill text-[11px] font-bold tracking-wider capitalize border px-2.5 py-0.5 rounded-full ${
                        prediction.riskLevel === "HIGH" 
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                          : prediction.riskLevel === "MEDIUM" 
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}>
                        {prediction.riskLevel} RISK
                      </span>
                    )}
                  </div>

                  {loadingPredict ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-3">
                      <Spinner label="Evaluating circular return patterns..." />
                    </div>
                  ) : prediction ? (
                    <div className="space-y-4">
                      {/* Visual Gauge */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Return Probability</span>
                          <span className={`font-extrabold text-sm ${
                            prediction.riskLevel === "HIGH" ? "text-rose-400" : prediction.riskLevel === "MEDIUM" ? "text-amber-400" : "text-emerald-400"
                          }`}>{prediction.returnProbability ?? 0}%</span>
                        </div>
                        <div className="relative pt-1">
                          <div className="h-2.5 w-full rounded-full bg-white/5 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 relative ${
                              prediction.riskLevel === "HIGH" ? "bg-gradient-to-r from-rose-600 to-rose-400" : prediction.riskLevel === "MEDIUM" ? "bg-gradient-to-r from-amber-600 to-amber-400" : "bg-gradient-to-r from-emerald-600 to-emerald-400"
                            }`} style={{ width: `${prediction.returnProbability || 0}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* Risk Factors */}
                      {prediction.topFactors && prediction.topFactors.length > 0 && (
                        <div className="space-y-2 rounded-xl bg-rose-500/[0.02] border border-rose-500/10 p-3">
                          <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                            <span>⚠️</span> Top Risk Factors
                          </div>
                          <ul className="text-xs text-slate-300 space-y-1.5 pl-1">
                            {prediction.topFactors.map((f, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-rose-500 mt-0.5">•</span>
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommendations */}
                      {prediction.recommendations && prediction.recommendations.length > 0 && (
                        <div className="space-y-2 rounded-xl bg-emerald-500/[0.02] border border-emerald-500/10 p-3">
                          <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <span>🌱</span> Recommended Mitigation
                          </div>
                          <ul className="text-xs text-slate-300 space-y-1.5 pl-1">
                            {prediction.recommendations.map((r, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-emerald-500 mt-0.5">•</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 text-center py-4 border border-dashed border-white/5 rounded-xl">
                      Could not compute risk score. Proceed with checkout.
                    </div>
                  )}
                </div>
   
                {/* SSA Smart Size Advisor (Module 8) */}
                {selectedListing?.category === "apparel" && (
                  <div className="border border-white/5 rounded-2xl p-5 bg-gradient-to-tr from-sky-500/[0.02] to-sky-500/[0.05] space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sky-400 text-lg">👕</span>
                        <span className="text-sm font-bold text-slate-200 tracking-wide">Smart Size Advisor</span>
                      </div>
                      {sizeAdvice && (
                        <span className="pill text-[10px] font-bold tracking-wider border border-sky-500/20 bg-sky-500/10 text-sky-300 rounded-full px-2.5 py-0.5">
                          {sizeAdvice.confidenceScore ?? 0}% FIT CONFIDENCE
                        </span>
                      )}
                    </div>
    
                    {loadingSize ? (
                      <div className="py-6 flex flex-col items-center justify-center gap-2">
                        <Spinner label="Predicting body fit..." />
                      </div>
                    ) : sizeAdvice ? (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center bg-sky-500/[0.03] border border-sky-500/10 rounded-xl p-3">
                          <span className="text-xs text-slate-400 font-medium">Recommended Size</span>
                          <span className="text-sm font-black text-sky-300 bg-sky-500/20 px-3 py-1 rounded-lg border border-sky-500/30 shadow-sm">
                            Size {sizeAdvice.recommendedSize ?? ""} ({sizeAdvice.fitPrediction ?? ""})
                          </span>
                        </div>
                        {sizeAdvice.reasoning && (
                          <div className="text-xs text-slate-300 bg-white/[0.01] rounded-lg p-2.5 border border-white/5 flex items-start gap-2">
                            <span className="text-sky-400/70 text-sm">“</span>
                            <span className="italic leading-relaxed">{sizeAdvice.reasoning}</span>
                            <span className="text-sky-400/70 text-sm self-end">”</span>
                          </div>
                        )}
                        
                        {sizeAdvice.alternativeSizes && sizeAdvice.alternativeSizes.length > 0 && (
                          <div className="text-[11px] text-slate-400 leading-normal border-t border-white/5 pt-2.5">
                            <span className="font-semibold text-slate-300">Fit Alternatives:</span>
                            <ul className="space-y-1 mt-1.5 pl-0.5">
                              {sizeAdvice.alternativeSizes.map((a, i) => (
                                <li key={i} className="flex justify-between border-b border-white/[0.02] pb-1 last:border-0 last:pb-0">
                                  <span className="font-semibold text-sky-400">Size {a?.size ?? ""}</span>
                                  <span className="text-slate-300">{a?.tradeoff ?? ""}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 text-center py-3 border border-dashed border-sky-500/10 rounded-xl">
                        Sizing metrics unavailable. Proceed with selection.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pricing breakdown */}
              {selectedListing?.markdown_schedule && (
                <div className="rounded-2xl bg-gradient-to-r from-leaf-950/20 to-leaf-900/10 border border-leaf-500/15 p-4 text-xs text-slate-300 flex gap-3 items-start">
                  <span className="text-leaf-400 text-base mt-0.5">♺</span>
                  <div>
                    <div className="font-bold text-leaf-400 mb-0.5">Dynamic Circular Price Protected</div>
                    <span className="text-slate-400 leading-relaxed">This preloved price is calculated based on brand retention and regional demand velocity. If unsold, prices update automatically per circular scheduling.</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => { setSelectedListing(null); setPrediction(null); setSizeAdvice(null); }} 
                  className="btn-ghost flex-1 py-2.5 text-sm rounded-xl font-bold transition-all duration-200 active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => buy.mutate(selectedListing.id)} 
                  disabled={buy.isPending} 
                  className="btn-primary flex-1 py-2.5 text-sm rounded-xl font-bold bg-gradient-to-r from-leaf-500 to-emerald-500 text-ink-950 hover:from-leaf-400 hover:to-emerald-400 shadow-lg shadow-leaf-500/20 hover:shadow-leaf-400/30 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {buy.isPending ? "Purchasing..." : "Confirm Purchase"}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
