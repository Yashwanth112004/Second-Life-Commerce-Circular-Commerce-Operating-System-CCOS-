import { motion } from "framer-motion";

const GRADE_COLORS = {
  "A+": "bg-leaf-500/20 text-leaf-400 border-leaf-500/40",
  A: "bg-leaf-500/20 text-leaf-400 border-leaf-500/40",
  B: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  C: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  D: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};

export function GradeBadge({ grade, label }) {
  return (
    <span className={`pill border ${GRADE_COLORS[grade] || GRADE_COLORS.B}`}>
      <span className="font-bold">{grade}</span>
      {label && <span className="opacity-80">· {label}</span>}
    </span>
  );
}

export function Stat({ label, value, sub, accent }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-extrabold ${accent || "text-white"}`}>{value}</div>
      {sub && <div className="mt-1 text-sm text-slate-400">{sub}</div>}
    </div>
  );
}

export function Section({ children, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Spinner({ label = "Analyzing…" }) {
  return (
    <div className="flex items-center gap-3 text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-leaf-500 border-t-transparent" />
      {label}
    </div>
  );
}
