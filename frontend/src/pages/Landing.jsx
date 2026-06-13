import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Section } from "../components.jsx";
import { api } from "../api.js";

const PROBLEM = [
  { n: "$816B", l: "global returns market, every year" },
  { n: "5B lbs", l: "of returns sent to US landfills annually" },
  { n: "$28B+", l: "Amazon's annual return-processing cost" },
  { n: "25%", l: "of returned products are destroyed" },
];

const PILLARS = [
  {
    t: "Intelligence Layer",
    d: "Every product gets an AI brain — predicting returns, grading condition, matching the next owner, and pricing resale in real time.",
  },
  {
    t: "Circular Marketplace",
    d: "Six interconnected marketplaces — Resale, Rental, Exchange, Donation, Refurbishment, and Parts — sharing trust and logistics.",
  },
  {
    t: "Sustainability Spine",
    d: "Every transaction generates measurable, verifiable carbon savings, redeemable as Green Credits.",
  },
];

export default function Landing() {
  return (
    <div className="space-y-16">
      <Section className="text-center">
        <span className="pill border border-leaf-500/40 bg-leaf-500/10 text-leaf-400">
          AI × Sustainability × Marketplace
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight text-white md:text-6xl">
          Every returned product deserves a <span className="text-leaf-400">second life</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
          A returned product isn't a failure of commerce — it's an unclaimed opportunity for a new
          owner, a lower carbon footprint, and a smarter planet. CCOS turns Amazon's #1 cost center
          into a circular revenue engine.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/return" className="btn-primary">
            ▶ Run the live demo
          </Link>
          <Link to="/impact" className="btn-ghost">
            Platform impact
          </Link>
          <DemoSeedButton />
        </div>
      </Section>

      <Section>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {PROBLEM.map((p, i) => (
            <motion.div
              key={p.l}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className="card text-center"
            >
              <div className="text-3xl font-extrabold text-white">{p.n}</div>
              <div className="mt-2 text-sm text-slate-400">{p.l}</div>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section>
        <h2 className="text-center text-2xl font-bold text-white">Three core pillars</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.t} className="card">
              <h3 className="text-lg font-bold text-leaf-400">{p.t}</h3>
              <p className="mt-2 text-sm text-slate-400">{p.d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="card text-center">
        <h2 className="text-2xl font-bold text-white">The 60-second wow</h2>
        <p className="mx-auto mt-2 max-w-2xl text-slate-400">
          Return a product → AI grades it from photos → choose <b>resell ($38)</b> over{" "}
          <b>refund ($15)</b> → GenAI writes the listing → we find 3 nearby buyers → you save 4.2 kg
          CO₂ and earn Green Credits. All in under a minute.
        </p>
        <Link to="/return" className="btn-primary mx-auto mt-6">
          Start the Return Wizard
        </Link>
      </Section>
    </div>
  );
}

function DemoSeedButton() {
  const [state, setState] = useState("idle"); // idle | loading | done
  async function seed() {
    setState("loading");
    try {
      await api.seedDemo();
      setState("done");
    } catch {
      setState("idle");
    }
  }
  if (state === "done") return <span className="pill bg-leaf-500/20 text-leaf-400">✓ Demo data ready — log in as alex@example.com</span>;
  return (
    <button onClick={seed} disabled={state === "loading"} className="btn-ghost">
      {state === "loading" ? "Seeding…" : "⚡ Seed demo data (for judges)"}
    </button>
  );
}
