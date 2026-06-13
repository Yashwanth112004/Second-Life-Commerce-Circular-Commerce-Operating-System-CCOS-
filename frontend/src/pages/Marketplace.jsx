import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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

export default function Marketplace() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ q: "", category: "", sort: "newest", page: 1 });
  const set = (k, v) => setFilters({ ...filters, [k]: v, page: k === "page" ? v : 1 });

  const channels = useQuery({ queryKey: ["channels"], queryFn: api.channels });
  const search = useQuery({
    queryKey: ["search", filters],
    queryFn: () => api.search({ ...filters, pageSize: 9 }),
  });

  const buy = useMutation({
    mutationFn: (id) => api.buy(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["search"] }),
  });

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
              <div key={l.id} className="card overflow-hidden p-0">
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
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>📍 {l.seller_city}</span>
                    <span>★ {Number(l.avg_rating).toFixed(1)} ({l.review_count})</span>
                  </div>
                  {user && (
                    <button onClick={() => buy.mutate(l.id)} disabled={buy.isPending}
                      className="btn-primary mt-3 w-full py-2 text-sm">Buy preloved</button>
                  )}
                  {!user && (
                    <Link to="/login" className="btn-ghost mt-3 block w-full py-2 text-center text-sm">Sign in to buy</Link>
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
    </div>
  );
}
