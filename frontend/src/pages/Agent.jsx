import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Spinner } from "../components.jsx";

const ACTION_STYLE = {
  sell_now: "bg-leaf-500/20 text-leaf-400",
  donate: "bg-sky-500/20 text-sky-300",
  hold: "bg-white/10 text-slate-400",
};

export default function Agent() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["araStatus"], queryFn: api.araStatus });
  const sugg = useQuery({ queryKey: ["araSuggestions"], queryFn: api.araSuggestions });
  const activity = useQuery({ queryKey: ["conciergeActivity"], queryFn: api.conciergeActivity });

  const toggle = useMutation({
    mutationFn: (enabled) => api.araToggle(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["araStatus"] }),
  });
  const listIt = useMutation({
    mutationFn: (orderId) => api.araList(orderId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["araSuggestions"] }); qc.invalidateQueries({ queryKey: ["conciergeActivity"] }); qc.invalidateQueries({ queryKey: ["concierge"] }); },
  });

  const enabled = status.data ? status.data.enabled : false;

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
            <span className="text-xs text-slate-500">last scan: {new Date(activity.data.last_scan).toLocaleTimeString()}</span>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ActStat label="Listings generated" value={activity.data.stats.listings_generated} />
            <ActStat label="Buyer matches found" value={activity.data.stats.buyer_matches_found} />
            <ActStat label="Donations made" value={activity.data.stats.donations_made} />
            <ActStat label="ARA-listed items" value={activity.data.stats.ara_listings} />
          </div>
          <div className="space-y-1">
            {activity.data.feed.length === 0 ? (
              <div className="text-sm text-slate-400">No activity yet — enable the agent and run a scan.</div>
            ) : activity.data.feed.map((f, i) => (
              <div key={i} className="flex items-center justify-between border-b border-white/5 py-1.5 text-sm last:border-0">
                <span className="text-slate-300"><b className="text-white">{f.title}</b> {f.body ? `— ${f.body}` : ""}</span>
                <span className="shrink-0 text-xs text-slate-500">{new Date(f.at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {listIt.isSuccess && (
        <div className="card border-leaf-500/40 text-leaf-300">
          ✓ Agent listed "{listIt.data.listing.title}" at ${listIt.data.listing.price} with {listIt.data.buyer_matches.matches.length} buyer matches.
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
            {sugg.data.suggestions.map((s, i) => (
              <motion.div key={s.order_id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="card flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img src={s.product.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                  <div>
                    <div className="font-semibold text-white">{s.product.title}</div>
                    <div className="text-xs text-slate-400">{s.reason}</div>
                    <Link to={`/passport/${s.order_id}`} className="text-xs text-leaf-400">View passport & twin →</Link>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-extrabold text-leaf-400">${s.estimated_value}</div>
                    <div className="text-xs text-slate-500">+{s.projected_gc} GC · {s.projected_carbon_kg} kg</div>
                  </div>
                  <span className={`pill capitalize ${ACTION_STYLE[s.action]}`}>{s.action.replace("_", " ")}</span>
                  {s.action === "sell_now" && (
                    <button onClick={() => listIt.mutate(s.order_id)} disabled={listIt.isPending}
                      className="btn-primary py-2 text-sm">List it now</button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      ) : null}
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
