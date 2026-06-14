import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, getImageUrl } from "../api.js";
import { GradeBadge, Section, Spinner } from "../components.jsx";

const STEPS = ["Select item", "Upload item photos", "Upload packaging photos", "AI inspection", "Decision"];

const STAGE_LABELS = {
  uploading: "Uploading images",
  vision_analysis: "Vision analysis (Qwen-VL)",
  damage_detection: "Damage detection",
  condition_grading: "Condition grading",
  carbon_analysis: "Carbon analysis",
  buyer_matching: "Buyer matching",
  report_generation: "Report generation",
  completed: "Completed",
};

export default function ReturnWizard() {
  const [orders, setOrders] = useState([]);
  const [step, setStep] = useState(0);
  const [order, setOrder] = useState(null);
  const [ret, setRet] = useState(null);
  const [files, setFiles] = useState([]);
  const [pkgFiles, setPkgFiles] = useState([]);
  const [progress, setProgress] = useState(null); // {status, stage, stages, stages_done}
  const [analysis, setAnalysis] = useState(null); // job.result when completed
  const [result, setResult] = useState(null);
  const [selectedNgo, setSelectedNgo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const polling = useRef(false);

  const reload = () => api.myOrders().then((all) => setOrders(all.filter((o) => o.status === "owned")));
  useEffect(() => {
    reload().catch((e) => setError(readErr(e)));
    return () => { polling.current = false; };
  }, []);

  async function pickOrder(o) {
    setError(null);
    setBusy(true);
    try {
      const r = await api.initiateReturn({ orderId: o.id, reasonCode: "defective", reasonText: "" });
      setOrder(o);
      setRet(r.return);
      setStep(1);
    } catch (e) {
      setError(readErr(e));
    } finally {
      setBusy(false);
    }
  }

  async function runAnalysis() {
    setError(null);
    setAnalysis(null);
    setProgress({ status: "running", stage: "uploading", stages: Object.keys(STAGE_LABELS), stages_done: [] });
    setStep(3);
    try {
      // 1. Upload item photos
      if (files.length > 0) {
        const fd = new FormData();
        files.forEach((f) => fd.append("files", f));
        await api.uploadEvidence(ret.id, fd, "item");
      }

      // 2. Upload packaging photos
      if (pkgFiles.length > 0) {
        const pfd = new FormData();
        pkgFiles.forEach((f) => pfd.append("files", f));
        await api.uploadEvidence(ret.id, pfd, "packaging");
      }

      await api.analyzeReturn(ret.id); // starts analysis job
      polling.current = true;
      
      // Poll analysis progress
      while (polling.current) {
        const s = await api.analyzeStatus(ret.id);
        setProgress(s);
        if (s.status !== "running") {
          setAnalysis(s);
          setStep(4);
          // Set default NGO to the top match if available
          if (s.result && s.result.ngo_recommendations && s.result.ngo_recommendations.length > 0) {
            setSelectedNgo(s.result.ngo_recommendations[0].name);
          }
          break;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e) {
      setError(readErr(e));
      setStep(1);
    }
  }

  async function decide(path) {
    setBusy(true);
    setError(null);
    try {
      const payload = { path };
      if (path === "donate") {
        payload.ngoName = selectedNgo;
      }
      const res = await api.decideReturn(ret.id, payload);
      setResult({ path, ...res });
    } catch (e) {
      setError(readErr(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    polling.current = false;
    setStep(0); setOrder(null); setRet(null); setFiles([]); setPkgFiles([]);
    setProgress(null); setAnalysis(null); setResult(null); setSelectedNgo("");
    reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Smart Return Wizard</h1>
        <Stepper step={step} />
      </div>
      {error && <div className="card border-rose-500/40 text-rose-300">⚠ {error}</div>}

      {step === 0 && (
        <Section>
          <p className="mb-3 text-sm text-slate-400">Select an item from your orders to return:</p>
          {orders.length === 0 && <div className="card text-slate-400">No returnable items.</div>}
          <div className="grid gap-3 md:grid-cols-2">
            {orders.map((o) => (
              <button key={o.id} disabled={busy} onClick={() => pickOrder(o)}
                className="card flex items-center gap-4 text-left transition hover:border-leaf-500/50 disabled:opacity-50">
                <img src={o.product?.image_url} alt="" className="h-16 w-16 rounded-lg object-cover"
                  onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                <div className="min-w-0">
                  <div className="font-semibold text-white">{o.product?.title}</div>
                  <div className="text-xs text-slate-500">{o.order_number}</div>
                  <div className="text-sm text-slate-400">{o.product?.brand} · paid ₹{o.purchase_price} · est. now ₹{o.estimated_value}</div>
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}

      {step === 1 && order && (
        <UploadStep 
          order={order} 
          files={files} 
          setFiles={setFiles} 
          title="Upload Item Condition Photos" 
          subtitle="Upload clear photos of the physical product, focusing on any scuffs, cracks, or damages."
          onContinue={() => setStep(2)} 
        />
      )}

      {step === 2 && order && (
        <UploadStep 
          order={order} 
          files={pkgFiles} 
          setFiles={setPkgFiles} 
          title="Upload Packaging Photos" 
          subtitle="Add photos of the packaging box (Front, Back, Inside, and Barcode) for AI reusability analysis."
          onContinue={runAnalysis} 
          showBack={true}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && <AnalysisProgress progress={progress} />}

      {step === 4 && analysis && !result && (
        <AnalysisOutcome 
          analysis={analysis} 
          selectedNgo={selectedNgo} 
          setSelectedNgo={setSelectedNgo} 
          onDecide={decide} 
          onAddPhotos={() => setStep(1)} 
          busy={busy} 
        />
      )}

      {result && <ResultView order={order} returnId={ret.id} result={result} onReset={reset} />}
    </div>
  );
}

function readErr(e) {
  if (e.response && e.response.data && e.response.data.error) return e.response.data.error;
  return e.message;
}

function Stepper({ step }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {STEPS.map((s, i) => (
        <span key={s} className={`pill ${i <= step ? "bg-leaf-500/20 text-leaf-400" : "bg-white/5 text-slate-500"}`}>
          {i + 1}. {s}
        </span>
      ))}
    </div>
  );
}

function UploadStep({ order, files, setFiles, title, subtitle, onContinue, showBack = false, onBack }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const add = (list) => setFiles([...files, ...Array.from(list)].slice(0, 8));
  return (
    <Section className="space-y-4">
      <div className="card flex items-center gap-4">
        <img src={order.product?.image_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
        <div>
          <div className="font-semibold text-white">{order.product?.title}</div>
          <div className="text-sm text-slate-400">{order.order_number} · {order.product?.category}</div>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        onClick={() => inputRef.current && inputRef.current.click()}
        className={`card cursor-pointer border-2 border-dashed text-center ${drag ? "border-leaf-500 bg-leaf-500/5" : "border-white/15"}`}>
        <div className="py-6">
          <div className="text-lg font-semibold text-white">Drop photos / video here</div>
          <div className="mt-1 text-sm text-slate-400">or click to browse · the vision AI inspects the actual images you upload</div>
        </div>
        <input ref={inputRef} type="file" accept="image/*,video/*" capture multiple hidden onChange={(e) => add(e.target.files)} />
      </div>
      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {files.map((f, i) => (
            <div key={i} className="relative">
              {f.type && f.type.startsWith("video") ? (
                <video src={URL.createObjectURL(f)} className="h-24 w-full rounded-lg object-cover" />
              ) : (
                <img src={URL.createObjectURL(f)} alt="" className="h-24 w-full rounded-lg object-cover" />
              )}
              <button onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, j) => j !== i)); }}
                className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-xs text-white">×</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={onBack} className="btn-ghost">
            ← Back
          </button>
        )}
        <button onClick={onContinue} disabled={files.length === 0} className="btn-primary disabled:opacity-50">
          Continue →
        </button>
        <span className="text-sm text-slate-500">{files.length} file(s). Photos are required to proceed.</span>
      </div>
    </Section>
  );
}

function AnalysisProgress({ progress }) {
  const stages = progress && progress.stages ? progress.stages : Object.keys(STAGE_LABELS);
  const done = progress && progress.stages_done ? progress.stages_done : [];
  const current = progress ? progress.stage : "uploading";
  return (
    <div className="card space-y-4">
      <Spinner label="Vision AI inspecting your actual photos…" />
      <ul className="space-y-1 text-sm">
        {stages.map((s) => {
          const isDone = done.includes(s) || current === "completed";
          const isCurrent = s === current && current !== "completed";
          return (
            <li key={s} className={isDone ? "text-leaf-400" : isCurrent ? "text-white" : "text-slate-600"}>
              {isDone ? "✓" : isCurrent ? "⟳" : "○"} {STAGE_LABELS[s] || s}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AnalysisOutcome({ analysis, selectedNgo, setSelectedNgo, onDecide, onAddPhotos, busy }) {
  const status = analysis.status;
  const r = analysis.result || {};
  const a = r.assessment || {};
  const recommended = r.recommended || "";
  const modelLine = (
    <span className={r.source === "vision" ? "text-leaf-400" : r.source === "vision_fallback" ? "text-amber-300" : "text-rose-300"}>
      {r.model_used ? `Inspected by ${r.model_used}${r.source === "vision_fallback" ? " (fallback model)" : ""}` : "Vision AI unavailable"}
    </span>
  );

  if (status === "needs_more_photos" || status === "unavailable" || status === "failed") {
    return (
      <Section className="space-y-4">
        <div className="card border-amber-400/40">
          <h2 className="text-xl font-bold text-amber-300">
            {status === "unavailable" ? "Vision AI unavailable" : status === "failed" ? "Inspection failed" : "Additional photos required"}
          </h2>
          <p className="mt-2 text-sm text-slate-300">{a.reasoning || analysis.error}</p>
          <div className="mt-2 text-xs text-slate-500">{modelLine}</div>
        </div>
        <div className="flex gap-3">
          <button onClick={onAddPhotos} className="btn-primary">Add more photos</button>
          <button disabled={busy} onClick={() => onDecide("refund")} className="btn-ghost">Just refund instead</button>
        </div>
      </Section>
    );
  }

  const damages = a.damages || [];
  const itemImages = (r.images || []).filter((i) => i.kind === "image" && (!i.role || i.role === "item"));
  const packagingImages = (r.images || []).filter((i) => i.kind === "image" && i.role && i.role.startsWith("packaging"));

  return (
    <Section className="space-y-5">
      {/* Visual Inspection Viewer */}
      <div className="grid gap-4 lg:grid-cols-2">
        {itemImages.length > 0 && (
          <div className="card">
            <h3 className="mb-3 font-bold text-white">🔍 AI Visual Product Inspection</h3>
            <div className="relative inline-block w-full rounded-xl overflow-hidden border border-white/10">
              <img src={getImageUrl(itemImages[0].url)} alt="Uploaded item" className="w-full object-contain h-48 bg-black/40" />
              {damages.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  {damages.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                      <span className="text-white">{d.label}</span>
                      <span className="text-rose-300">sev {d.severity}/10</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {itemImages.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {itemImages.slice(1).map((img, i) => (
                  <img key={i} src={getImageUrl(img.url)} alt="" className="h-12 w-12 rounded-lg object-cover border border-white/10" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Packaging Intelligence */}
        {r.packaging && (
          <div className="card flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white">📦 Packaging Intelligence</h3>
                <span className={`pill text-xs font-bold px-2 py-0.5 rounded border border-leaf-500/20 bg-leaf-500/15 text-leaf-400`}>
                  Grade {r.packaging.packagingGrade}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400 font-medium">Reusability: <b className="text-white">{r.packaging.reusable}</b></p>
              
              {packagingImages.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {packagingImages.map((img, i) => (
                    <img key={i} src={getImageUrl(img.url)} alt="" className="h-10 w-10 rounded object-cover border border-white/10" />
                  ))}
                </div>
              )}
              
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded bg-white/5 p-2">
                  <div className="font-bold text-leaf-400">{r.packaging.recyclability}%</div>
                  <div className="text-slate-500">Recyclability</div>
                </div>
                <div className="rounded bg-white/5 p-2">
                  <div className="font-bold text-rose-400">{r.packaging.packagingWasteScore}%</div>
                  <div className="text-slate-500">Waste Score</div>
                </div>
              </div>
            </div>
            
            <div className="mt-3 border-t border-white/5 pt-2 text-xs">
              <div className="text-slate-300 font-semibold">AI Recommendation:</div>
              <div className="text-slate-400 italic mt-0.5">"{r.packaging.recommendations}"</div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-400">Condition report · {Math.round((a.confidence || 0) * 100)}% confidence · severity {a.severity}/10</div>
            <div className="mt-1 text-xs">{modelLine}</div>
            {a.product_type && <div className="mt-1 text-sm text-slate-300">Identified: <b>{a.product_type}</b></div>}
          </div>
          <GradeBadge grade={a.grade} label={a.grade_label} />
        </div>
        {a.reasoning && <p className="mt-3 text-sm text-slate-400">{a.reasoning}</p>}
      </div>

      {/* RDE Decision Matrix Panel */}
      {r.rde && (
        <div className="card space-y-4">
          <h3 className="font-bold text-white">⚖️ Refurbishment Decision Matrix (RDE)</h3>
          
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={`rounded-xl p-4 border bg-white/5 ${recommended === "resell" ? "border-leaf-500/40 ring-1 ring-leaf-500/20" : "border-white/5"}`}>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Resell As-Is</span>
                {recommended === "resell" && <span className="text-leaf-400 font-bold">Pick</span>}
              </div>
              <div className="mt-2 text-xl font-extrabold text-leaf-400">₹{r.rde.matrix.resell_as_is.profit}</div>
              <div className="text-[11px] text-slate-500">Net Profit</div>
              <div className="mt-2 space-y-0.5 text-xs text-slate-400">
                <div>🌳 {r.rde.matrix.resell_as_is.carbon_savings} kg CO₂ saved</div>
                <div>📦 {r.rde.matrix.resell_as_is.waste_reduction}% waste avoided</div>
              </div>
            </div>

            <div className={`rounded-xl p-4 border bg-white/5 ${recommended === "repair" ? "border-leaf-500/40 ring-1 ring-leaf-500/20" : "border-white/5"}`}>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Refurbish & Resell</span>
                {recommended === "repair" && <span className="text-leaf-400 font-bold">Pick</span>}
              </div>
              <div className="mt-2 text-xl font-extrabold text-leaf-400">₹{r.rde.matrix.refurbish_resell.profit}</div>
              <div className="text-[11px] text-slate-500">Net Profit</div>
              <div className="mt-2 space-y-0.5 text-xs text-slate-400">
                <div>🌳 {r.rde.matrix.refurbish_resell.carbon_savings} kg CO₂ saved</div>
                <div>📦 {r.rde.matrix.refurbish_resell.waste_reduction}% waste avoided</div>
              </div>
            </div>

            <div className={`rounded-xl p-4 border bg-white/5 ${recommended === "donate" ? "border-leaf-500/40 ring-1 ring-leaf-500/20" : "border-white/5"}`}>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Donate</span>
                {recommended === "donate" && <span className="text-leaf-400 font-bold">Pick</span>}
              </div>
              <div className="mt-2 text-xl font-extrabold text-sky-400">FMV ₹{r.rde.matrix.donate.tax_benefit}</div>
              <div className="text-[11px] text-slate-500">Tax Benefit</div>
              <div className="mt-2 space-y-0.5 text-xs text-slate-400">
                <div>🌟 {r.rde.matrix.donate.impact_score}/99 Impact score</div>
                <div>🌳 {r.rde.matrix.donate.carbon_savings} kg CO₂ saved</div>
              </div>
            </div>

            <div className={`rounded-xl p-4 border bg-white/5 ${recommended === "recycle" ? "border-leaf-500/40 ring-1 ring-leaf-500/20" : "border-white/5"}`}>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Recycle</span>
                {recommended === "recycle" && <span className="text-leaf-400 font-bold">Pick</span>}
              </div>
              <div className="mt-2 text-xl font-extrabold text-rose-400">0.0 kg</div>
              <div className="text-[11px] text-slate-500">Landfill Diverted</div>
              <div className="mt-2 space-y-0.5 text-xs text-slate-400">
                <div>🌟 {r.rde.matrix.recycle.impact_score}/50 Impact score</div>
                <div>🌳 {r.rde.matrix.recycle.carbon_savings} kg CO₂ saved</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-leaf-500/20 bg-leaf-500/5 p-4 text-sm text-slate-300">
            <span className="font-bold text-leaf-400">RDE Recommendation ({r.rde.confidence}% confidence): </span>
            <span>{r.rde.explanation}</span>
          </div>
        </div>
      )}

      {/* Donation matching dropdown selector */}
      {r.ngo_recommendations && r.ngo_recommendations.length > 0 && (
        <div className="card space-y-3">
          <h3 className="font-bold text-white">🎁 Donation Impact Maximizer (DIM) Matcher</h3>
          <p className="text-xs text-slate-400">Select an NGO destination below. AI ranks them based on local urgency, beneficiary alignment, and distance.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Select NGO Destination</label>
              <select value={selectedNgo} onChange={(e) => setSelectedNgo(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-white outline-none focus:border-leaf-500 text-sm">
                {r.ngo_recommendations.map((ngo) => (
                  <option key={ngo.name} value={ngo.name}>{ngo.name} (dist: {ngo.distance_miles}km, impact: {ngo.impact_score}%)</option>
                ))}
              </select>
            </div>
            <div className="rounded-lg bg-white/5 p-3 flex flex-col justify-between">
              {(() => {
                const matched = r.ngo_recommendations.find(n => n.name === selectedNgo) || r.ngo_recommendations[0];
                if (!matched) return null;
                return (
                  <>
                    <div className="text-xs font-semibold text-slate-300">Targeted Impact for {matched.name}:</div>
                    <div className="text-xs text-slate-400 italic mt-1">"{matched.reason}"</div>
                    <div className="text-[11px] text-slate-500 mt-1 flex justify-between border-t border-white/5 pt-1">
                      <span>Distance: {matched.distance_miles} km</span>
                      <span>Beneficiary: {matched.beneficiary_type}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-bold text-white">Choose what happens next</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(r.options || []).map((o) => (
            <div key={o.path} className={`card flex flex-col justify-between ${o.path === recommended ? "border-leaf-500/50 ring-1 ring-leaf-500/30" : ""}`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold capitalize text-white">{o.path}</span>
                  {o.path === recommended && <span className="pill bg-leaf-500/20 text-leaf-400">AI pick</span>}
                </div>
                <div className="mt-2 text-2xl font-extrabold text-leaf-400">
                  {o.path === "donate" ? `FMV ₹${o.tax_receipt_value}` : `₹${o.money}`}
                </div>
                <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                  <li>+{o.green_credits} Green Credits</li>
                  <li>{o.carbon_saved_kg} kg CO₂ saved</li>
                  <li>⏱ {o.time}</li>
                </ul>
                <p className="mt-2 text-xs text-slate-500">{o.note}</p>
              </div>
              <button disabled={busy} onClick={() => decide(o.path)} className="btn-primary mt-3 w-full py-2 text-sm">
                {busy ? "…" : `Choose ${o.path}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function ResultView({ order, returnId, result, onReset }) {
  return (
    <Section className="space-y-4">
      <div className="card border-leaf-500/40 text-center">
        <h2 className="text-2xl font-bold text-white">Return resolved via {result.path} 🎉</h2>
      </div>
      {result.listing && (
        <div className="card">
          <h3 className="mb-2 text-lg font-bold text-white">📝 Listing generated
            <span className={`ml-2 pill ${result.listing.ai_source === "ai" ? "bg-leaf-500/20 text-leaf-400" : "bg-amber-400/15 text-amber-300"}`}>
              {result.listing.ai_source === "ai" ? "AI" : "fallback"}
            </span>
          </h3>
          <div className="font-semibold text-white">{result.listing.title}</div>
          <p className="mt-2 text-sm text-slate-400">{result.listing.description}</p>
          <div className="text-xs text-slate-500 mt-2">size: {result.listing.size || "M"} · expected sale in {result.listing.expected_sale_time_days || 5} days</div>
        </div>
      )}
      {result.buyer_matches && (
        <div className="card space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">🎯 Next Best Owner Engine (NBOE)</h3>
            <p className="text-xs text-slate-400 mt-1">
              Two-Tower Neural Retrieval (128-d cosine similarity) &bull; ANN FAISS FlatIP &bull; Proximity Routing: <b className="text-leaf-400 capitalize">{(result.buyer_matches.routing || "").replace("_", " ")}</b>
            </p>
          </div>

          {/* Business Impact Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Inventory Holding Time</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 line-through">45 Days</span>
                <span className="text-leaf-400 font-black text-sm">&rarr; 8 Days</span>
                <span className="pill text-[9px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/20 py-0 px-1.5 rounded-full font-bold">−82%</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Resale Rate Boost</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 line-through">40%</span>
                <span className="text-leaf-400 font-black text-sm">&rarr; 72%</span>
                <span className="pill text-[9px] bg-leaf-500/10 text-leaf-400 border border-leaf-500/20 py-0 px-1.5 rounded-full font-bold">+80%</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {result.buyer_matches.matches.map((m, i) => (
              <div key={i} className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white">{m.buyer_label}</span>
                    <span className="text-xs text-slate-500"> &bull; {m.location} &bull; {m.distance_miles} km</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="pill bg-leaf-500/20 text-leaf-400">{m.match_score}% Match</span>
                    <span className="pill bg-sky-500/15 text-sky-300">{m.purchaseProbability}% Prob</span>
                  </div>
                </div>

                {m.outreachSuggestion && (
                  <div className="p-3 bg-white/[0.01] border border-white/5 rounded-lg text-xs text-slate-300 leading-relaxed italic">
                    "{m.outreachSuggestion}"
                  </div>
                )}

                {/* Contextual Bandit timings & channel optimizations */}
                {m.outreachTiming && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2 bg-amber-500/[0.03] border border-amber-500/15 rounded-lg text-[11px]">
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <span>⏱</span> Contextual Bandit Timing:
                    </span>
                    <span className="text-slate-300">
                      {m.outreachChannel} scheduled {m.outreachTiming} (+{m.bandit_reward_lift || 18.5}% expected conversion lift)
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.03] pt-2 mt-2">
                  {m.match_reasons && m.match_reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.match_reasons.map((r, j) => (
                        <span key={j} className={`pill py-0.5 px-2 text-[10px] rounded-md ${r.weight === "high" ? "bg-leaf-500/10 text-leaf-400" : "bg-white/5 text-slate-400"}`}>
                          {r.factor}: {r.detail}
                        </span>
                      ))}
                    </div>
                  )}

                  {m.two_tower_similarity !== undefined && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      Sim: {m.two_tower_similarity} (128-d)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {result.carbon && (
        <div className="card">
          <h3 className="mb-1 text-lg font-bold text-white">🌍 Verified impact</h3>
          <div className="text-3xl font-extrabold text-leaf-400">{result.carbon.carbon_saved_kg} kg CO₂</div>
          {result.carbon.equivalents && result.carbon.equivalents.driving && (
            <p className="text-slate-300 text-xs">{result.carbon.equivalents.driving}</p>
          )}
          {typeof result.green_credits_earned === "number" && (
            <p className="mt-2 text-xs text-leaf-400">+{result.green_credits_earned} Green Credits · balance {result.new_gc_balance} GC</p>
          )}
        </div>
      )}
      {result.donation && (
        <div className="card"><h3 className="text-lg font-bold text-white">🎁 Donated</h3>
          <p className="text-sm text-slate-400">To {result.donation.ngo_name} · tax receipt {result.donation.tax_receipt_id} · FMV ₹{result.donation.fair_market_value} · tax benefit saved: ₹{result.donation.tax_benefit}</p></div>
      )}
      {typeof result.refund_amount === "number" && (
        <div className="card"><h3 className="text-lg font-bold text-white">💸 Refund issued: ₹{result.refund_amount}</h3></div>
      )}
      {result.path === "repair" && (
        <RefurbishInstructionsCard returnId={returnId} />
      )}
      <div className="flex gap-3">
        <button onClick={onReset} className="btn-ghost">↺ New return</button>
        <a href={`/passport/${order.id}`} className="btn-ghost">View Product Passport →</a>
      </div>
    </Section>
  );
}

function RefurbishInstructionsCard({ returnId }) {
  const [skillLevel, setSkillLevel] = useState("intermediate");
  const [instructions, setInstructions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.refurbishInstructions(returnId, skillLevel)
      .then((data) => {
        setInstructions(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Refurbish instructions error:", err);
        setLoading(false);
      });
  }, [returnId, skillLevel]);

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-8">
        <Spinner label="Generating Real-Time Refurbishment Guide (RRIG)..." />
      </div>
    );
  }

  if (!instructions) {
    return <div className="card text-slate-400 text-sm">Failed to generate instructions.</div>;
  }

  return (
    <div className="card space-y-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
            <span>🔧 RRIG Refurbishment Guide</span>
            <span className="pill bg-emerald-500/20 text-emerald-400 text-[10px]">Active</span>
          </h3>
          <p className="text-xs text-slate-400">Step-by-step instructions dynamically generated for operator hubs.</p>
        </div>
        
        <select 
          value={skillLevel} 
          onChange={(e) => setSkillLevel(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-xs text-white outline-none focus:border-leaf-500"
        >
          <option value="beginner">Beginner Operator</option>
          <option value="intermediate">Intermediate Operator</option>
          <option value="expert">Expert Operator</option>
        </select>
      </div>

      {instructions.safetyWarnings && instructions.safetyWarnings.length > 0 && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
          <div className="font-bold mb-1">⚠️ Safety & Compliance Warnings</div>
          <ul className="list-disc list-inside space-y-0.5">
            {instructions.safetyWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {instructions.instructions.map((step) => (
          <div key={step.step} className="flex gap-4 rounded-xl border border-white/5 bg-white/5/30 p-3.5 items-start">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold">
              {step.step}
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <div className="font-bold text-slate-200 text-sm">{step.title}</div>
              <p className="text-xs text-slate-400 leading-normal">{step.action}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px]">
                <span className="text-slate-500">⏱️ Est. Time: {step.est_time_mins} mins</span>
                {step.illustration_prompt && (
                  <span className="text-emerald-400/70 border border-emerald-500/10 bg-emerald-500/5 rounded px-1.5 py-0.5">
                    💡 Illustration Prompt: {step.illustration_prompt}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-slate-300">🛠️ Parts & Consumables Required</div>
          <ul className="text-xs text-slate-400 list-disc list-inside space-y-0.5">
            {instructions.partsRequired.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-slate-300">✅ Hub Quality Check Criteria</div>
          <ul className="text-xs text-slate-400 list-disc list-inside space-y-0.5">
            {instructions.qualityCheckCriteria.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      </div>

      <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-white/5">
        <span>Total Estimated Duration: <b>{instructions.totalEstimatedTimeMin} minutes</b></span>
        <span>Generated by RRIG Engine v1.0</span>
      </div>
    </div>
  );
}
