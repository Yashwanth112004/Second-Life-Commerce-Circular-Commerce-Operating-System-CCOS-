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

  const data = search.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

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

      {buy.isSuccess && (
        <div className="card border-leaf-500/40 text-leaf-300">
          ✓ Purchased preloved — you earned {buy.data.green_credits_earned} GC and saved {buy.data.carbon.carbon_saved_kg} kg CO₂.
        </div>
      )}

      {search.isLoading ? (
        <Spinner label="Searching circular inventory…" />
      ) : (
        <>
          <div className="text-sm text-slate-400">{data ? data.total : 0} results</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data && data.results.map((l) => (
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
                      <span className="text-2xl font-extrabold text-leaf-400">${l.price}</span>
                      <span className="text-sm text-slate-500 line-through">${l.msrp}</span>
                      <span className="pill bg-leaf-500/20 text-leaf-400">−{l.savings_pct}%</span>
                    </div>

                    {/* AI pricing badge */}
                    <div className="mt-2.5 text-[11px] text-leaf-400 flex items-center gap-1 bg-leaf-500/10 border border-leaf-500/20 rounded-lg px-2 py-1">
                      <span>♺</span>
                      <span>AI Price Recommended · expected sale in {l.expected_sale_time_days || 5} days</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>📍 {l.seller_city}</span>
                      <span>★ {Number(l.avg_rating).toFixed(1)} ({l.review_count})</span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-5">
              
              <div>
                <h3 className="text-xl font-bold text-white">Review & Checkout</h3>
                <p className="text-sm text-slate-400">Previewing circular return intent & pricing diagnostics.</p>
              </div>

              {/* Item Summary */}
              <div className="flex gap-4 rounded-xl bg-white/5 p-3">
                <img src={selectedListing.image_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                <div>
                  <div className="font-semibold text-white truncate max-w-[260px]">{selectedListing.title}</div>
                  <div className="text-sm text-leaf-400 font-bold">${selectedListing.price}</div>
                  <div className="text-xs text-slate-500">MSRP: ${selectedListing.msrp} · size: {selectedListing.size || "M"}</div>
                </div>
              </div>

              {/* RIP Analysis */}
              <div className="border border-white/5 rounded-xl p-4 bg-white/5/30 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-300">♺ AI Return Risk Assessment</span>
                  {prediction && (
                    <span className={`pill text-xs font-bold capitalize border px-2 py-0.5 rounded-full ${GAUGE_COLORS[prediction.riskLevel] || "border-slate-500/20"}`}>
                      {prediction.riskLevel} Risk
                    </span>
                  )}
                </div>

                {loadingPredict ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-2">
                    <Spinner label="Evaluating pre-purchase return risk..." />
                  </div>
                ) : prediction ? (
                  <div className="space-y-3">
                    {/* Visual Gauge */}
                    <div className="space-y-1">
                      <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${
                          prediction.riskLevel === "HIGH" ? "bg-rose-500" : prediction.riskLevel === "MEDIUM" ? "bg-amber-500" : "bg-emerald-500"
                        }`} style={{ width: `${prediction.returnProbability}%` }} />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>LOW</span>
                        <span className="font-bold text-slate-300">{prediction.returnProbability}% Probability</span>
                        <span>HIGH</span>
                      </div>
                    </div>

                    {/* Risk Factors */}
                    {prediction.topFactors && prediction.topFactors.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-slate-400">Risk Factors:</div>
                        <ul className="text-xs text-slate-300 list-disc list-inside space-y-0.5">
                          {prediction.topFactors.map((f, i) => <li key={i} className="text-rose-300">{f}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    {prediction.recommendations && prediction.recommendations.length > 0 && (
                      <div className="space-y-1 border-t border-white/5 pt-2">
                        <div className="text-xs font-bold text-slate-400">Recommendations:</div>
                        <ul className="text-xs text-slate-300 list-disc list-inside space-y-0.5">
                          {prediction.recommendations.map((r, i) => <li key={i} className="text-emerald-300">{r}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 text-center py-2">Could not compute risk score. Proceed with checkout.</div>
                )}
              </div>
 
              {/* SSA Smart Size Advisor (Module 8) */}
              {selectedListing.category === "apparel" && (
                <div className="border border-white/5 rounded-xl p-4 bg-sky-500/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-300">👕 Smart Size Advisor</span>
                    {sizeAdvice && (
                      <span className="pill text-[10px] font-bold border border-sky-500/30 bg-sky-500/10 text-sky-300">
                        {sizeAdvice.confidenceScore}% Fit Confidence
                      </span>
                    )}
                  </div>
 
                  {loadingSize ? (
                    <div className="py-2 flex flex-col items-center justify-center gap-1">
                      <Spinner label="Predicting perfect fit..." />
                    </div>
                  ) : sizeAdvice ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-400">Recommended Size:</span>
                        <span className="text-sm font-extrabold text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded-lg border border-sky-500/40">
                          Size {sizeAdvice.recommendedSize} ({sizeAdvice.fitPrediction})
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 italic">"{sizeAdvice.reasoning}"</p>
                      
                      {sizeAdvice.alternativeSizes && sizeAdvice.alternativeSizes.length > 0 && (
                        <div className="text-[10px] text-slate-400 leading-normal border-t border-white/5 pt-1.5 mt-1">
                          <span className="font-semibold text-slate-300">Fit Alternatives:</span>
                          <ul className="list-disc list-inside space-y-0.5 mt-0.5">
                            {sizeAdvice.alternativeSizes.map((a, i) => (
                              <li key={i}>
                                <span className="font-semibold text-sky-400">Size {a.size}:</span> {a.tradeoff}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 text-center py-1">Sizing metrics unavailable. Proceed with selection.</div>
                  )}
                </div>
              )}

              {/* Pricing breakdown */}
              {selectedListing.markdown_schedule && (
                <div className="rounded-xl bg-leaf-500/5 border border-leaf-500/10 p-3 text-xs text-slate-300">
                  <div className="font-bold text-leaf-400 mb-1">♺ Dynamic Circular Price Protected</div>
                  <span>This preloved price is calculated based on brand retention and regional demand velocity. If unsold, prices update automatically per circular scheduling.</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button onClick={() => { setSelectedListing(null); setPrediction(null); setSizeAdvice(null); }} className="btn-ghost flex-1 py-2 text-sm">Cancel</button>
                <button onClick={() => buy.mutate(selectedListing.id)} disabled={buy.isPending} className="btn-primary flex-1 py-2 text-sm">
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
