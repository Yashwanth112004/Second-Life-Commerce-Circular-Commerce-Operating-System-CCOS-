import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api.js";
import { GradeBadge, Section, Spinner } from "../components.jsx";

const STEPS = ["Select item", "Upload evidence", "AI inspection", "Decision"];

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
  const [progress, setProgress] = useState(null); // {status, stage, stages, stages_done}
  const [analysis, setAnalysis] = useState(null); // job.result when completed
  const [result, setResult] = useState(null);
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
    setStep(2);
    try {
      if (files.length > 0) {
        const fd = new FormData();
        files.forEach((f) => fd.append("files", f));
        await api.uploadEvidence(ret.id, fd);
      }
      await api.analyzeReturn(ret.id); // 202, starts job
      polling.current = true;
      // Poll real backend status.
      while (polling.current) {
        const s = await api.analyzeStatus(ret.id);
        setProgress(s);
        if (s.status !== "running") {
          setAnalysis(s);
          setStep(3);
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
      const res = await api.decideReturn(ret.id, { path });
      setResult({ path, ...res });
    } catch (e) {
      setError(readErr(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    polling.current = false;
    setStep(0); setOrder(null); setRet(null); setFiles([]);
    setProgress(null); setAnalysis(null); setResult(null);
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
                <img src={o.product.image_url} alt="" className="h-16 w-16 rounded-lg object-cover"
                  onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                <div className="min-w-0">
                  <div className="font-semibold text-white">{o.product.title}</div>
                  <div className="text-xs text-slate-500">{o.order_number}</div>
                  <div className="text-sm text-slate-400">{o.product.brand} · paid ${o.purchase_price} · est. now ${o.estimated_value}</div>
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}

      {step === 1 && order && (
        <UploadStep order={order} files={files} setFiles={setFiles} onContinue={runAnalysis} />
      )}

      {step === 2 && <AnalysisProgress progress={progress} />}

      {step === 3 && analysis && !result && (
        <AnalysisOutcome analysis={analysis} onDecide={decide} onAddPhotos={() => setStep(1)} busy={busy} />
      )}

      {result && <ResultView order={order} result={result} onReset={reset} />}
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

function UploadStep({ order, files, setFiles, onContinue }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const add = (list) => setFiles([...files, ...Array.from(list)].slice(0, 8));
  return (
    <Section className="space-y-4">
      <div className="card flex items-center gap-4">
        <img src={order.product.image_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
        <div>
          <div className="font-semibold text-white">{order.product.title}</div>
          <div className="text-sm text-slate-400">{order.order_number} · {order.product.category}</div>
        </div>
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
              {f.type.startsWith("video") ? (
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
        <button onClick={onContinue} disabled={files.length === 0} className="btn-primary disabled:opacity-50">
          Run vision inspection →
        </button>
        <span className="text-sm text-slate-500">{files.length} file(s). Photos are required for a real inspection.</span>
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

function AnalysisOutcome({ analysis, onDecide, onAddPhotos, busy }) {
  // analysis = job snapshot { status, result }
  const status = analysis.status;
  const r = analysis.result || {};
  const a = r.assessment || {};
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
          {a.required_views && a.required_views.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-1 text-sm text-slate-400">
              {a.required_views.map((v) => <li key={v}>📸 {v}</li>)}
            </ul>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={onAddPhotos} className="btn-primary">Add more photos</button>
          <button disabled={busy} onClick={() => onDecide("refund")} className="btn-ghost">Just refund instead</button>
        </div>
      </Section>
    );
  }

  const damages = a.damages || [];
  const images = (r.images || []).filter((i) => i.kind === "image");
  return (
    <Section className="space-y-5">
      {/* Visual Inspection Viewer — uploaded image with damage annotations */}
      {images.length > 0 && (
        <div className="card">
          <h3 className="mb-3 font-bold text-white">🔍 AI Visual Inspection</h3>
          <div className="relative inline-block w-full max-w-lg rounded-xl overflow-hidden border border-white/10">
            <img src={images[0].url} alt="Uploaded inspection" className="w-full object-contain" />
            {damages.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                {damages.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-white">{d.label}</span>
                    <span className="text-rose-300">sev {d.severity}/10</span>
                    <span className="text-slate-400">{Math.round((d.confidence || 0) * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-2 flex gap-2">
              {images.slice(1).map((img, i) => (
                <img key={i} src={img.url} alt="" className="h-16 w-16 rounded-lg object-cover border border-white/10" />
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>Inspection ID: {a.id || "—"}</span>
            <span>Model: {r.model_used || "—"}</span>
            <span>Source: {r.source}</span>
          </div>
        </div>
      )}

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
        {damages.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-semibold text-white">Detected damage</div>
            <div className="mt-2 space-y-2">
              {damages.map((d, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <span className="text-slate-300">{d.label} <span className="text-slate-500">({d.location})</span></span>
                  <span className="text-slate-400">severity {d.severity}/10 · {Math.round((d.confidence || 0) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {r.root_cause && (
          <div className="mt-4 rounded-lg bg-white/5 p-3 text-sm">
            <span className="text-slate-400">Root cause (NLP): </span>
            <span className="text-white">{r.root_cause.true_reason}</span>
          </div>
        )}
        <a href={api.inspectionPdfUrl(analysis.result.return_id)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-leaf-400 underline">
          📄 Download inspection report PDF
        </a>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold text-white">Choose what happens next</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(r.options || []).map((o) => (
            <div key={o.path} className={`card ${o.path === r.recommended ? "border-leaf-500/50 ring-1 ring-leaf-500/30" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold capitalize text-white">{o.path}</span>
                {o.path === r.recommended && <span className="pill bg-leaf-500/20 text-leaf-400">AI pick</span>}
              </div>
              <div className="mt-2 text-2xl font-extrabold text-leaf-400">${o.money}</div>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                <li>+{o.green_credits} Green Credits</li>
                <li>{o.carbon_saved_kg} kg CO₂ saved</li>
                <li>⏱ {o.time}</li>
              </ul>
              <p className="mt-2 text-xs text-slate-500">{o.note}</p>
              <button disabled={busy} onClick={() => onDecide(o.path)} className="btn-primary mt-3 w-full py-2 text-sm">
                {busy ? "…" : `Choose ${o.path}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function ResultView({ order, result, onReset }) {
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
        </div>
      )}
      {result.buyer_matches && (
        <div className="card">
          <h3 className="mb-3 text-lg font-bold text-white">🎯 Next Best Owner — Explainable Matching</h3>
          <p className="text-sm text-slate-400">Routing: <b className="text-leaf-400">{result.buyer_matches.routing.replace("_", " ")}</b> · pool of {result.buyer_matches.pool_size} candidates</p>
          <div className="mt-2 space-y-3">
            {result.buyer_matches.matches.map((m, i) => (
              <div key={i} className="rounded-lg bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white">{m.buyer_label}</span>
                    <span className="text-sm text-slate-500"> · {m.location} · {m.distance_miles} mi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="pill bg-leaf-500/20 text-leaf-400">{m.match_score}% match</span>
                    <span className="pill bg-sky-500/15 text-sky-300">{Math.round(m.conversion_probability * 100)}% likely to buy</span>
                  </div>
                </div>
                {m.match_reasons && m.match_reasons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.match_reasons.map((r, j) => (
                      <span key={j} className={`pill text-xs ${r.weight === "high" ? "bg-leaf-500/10 text-leaf-400" : "bg-white/5 text-slate-400"}`}>
                        {r.factor}: {r.detail}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {result.carbon && (
        <div className="card">
          <h3 className="mb-1 text-lg font-bold text-white">🌍 Verified impact</h3>
          <div className="text-3xl font-extrabold text-leaf-400">{result.carbon.carbon_saved_kg} kg CO₂</div>
          <p className="text-slate-300">{result.carbon.equivalents.driving}</p>
          {typeof result.green_credits_earned === "number" && (
            <p className="mt-2 text-leaf-400">+{result.green_credits_earned} Green Credits · balance {result.new_gc_balance} GC</p>
          )}
        </div>
      )}
      {result.donation && (
        <div className="card"><h3 className="text-lg font-bold text-white">🎁 Donated</h3>
          <p className="text-sm text-slate-400">To {result.donation.ngo_name} · tax receipt {result.donation.tax_receipt_id} · FMV ${result.donation.fair_market_value}</p></div>
      )}
      {typeof result.refund_amount === "number" && (
        <div className="card"><h3 className="text-lg font-bold text-white">💸 Refund issued: ${result.refund_amount}</h3></div>
      )}
      <div className="flex gap-3">
        <button onClick={onReset} className="btn-ghost">↺ New return</button>
        <a href={`/passport/${order.id}`} className="btn-ghost">View Product Passport →</a>
      </div>
    </Section>
  );
}
