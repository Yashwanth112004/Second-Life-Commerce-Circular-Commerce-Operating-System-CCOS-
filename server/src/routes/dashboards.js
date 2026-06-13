import {
    Router
} from "express";
import {
    query
} from "../db/pool.js";
import {
    requireAuth,
    requireRole
} from "../middleware/auth.js";
import {
    asyncHandler
} from "../middleware/common.js";

const router = Router();
router.use(requireAuth);

// ---- Customer dashboard ----
router.get(
    "/customer",
    asyncHandler(async (req, res) => {
        const uid = req.user.id;
        const [wallet, owned, activity, listings] = await Promise.all([
            query("SELECT * FROM wallets WHERE user_id=$1", [uid]),
            query(
                `SELECT COUNT(*)::int n, COALESCE(SUM(o.purchase_price),0) spent
         FROM orders o WHERE o.user_id=$1 AND o.status='owned'`,
                [uid]
            ),
            query(
                `SELECT
           (SELECT COUNT(*)::int FROM returns WHERE user_id=$1 AND status='completed') returns_resolved,
           (SELECT COUNT(*)::int FROM donations WHERE donor_id=$1) donations,
           (SELECT COUNT(*)::int FROM carbon_events WHERE user_id=$1) circular_actions`,
                [uid]
            ),
            query(
                `SELECT status, COUNT(*)::int n FROM marketplace_listings WHERE seller_id=$1 GROUP BY status`,
                [uid]
            ),
        ]);
        res.json({
            wallet: wallet.rows[0] || {},
            owned_products: owned.rows[0].n,
            owned_value: Number(owned.rows[0].spent),
            activity: activity.rows[0],
            marketplace: listings.rows.reduce((acc, r) => ({
                ...acc,
                [r.status]: r.n
            }), {}),
        });
    })
);

// ---- Seller dashboard ----
router.get(
    "/seller",
    asyncHandler(async (req, res) => {
        const uid = req.user.id;
        const [metrics, listings, rootCauses, revenueByMonth] = await Promise.all([
            query("SELECT * FROM seller_metrics WHERE seller_id=$1", [uid]),
            query(
                `SELECT status, COUNT(*)::int n, COALESCE(SUM(price),0) value
         FROM marketplace_listings WHERE seller_id=$1 GROUP BY status`,
                [uid]
            ),
            query(
                `SELECT (ap.output->>'true_reason') reason, COUNT(*)::int n
         FROM ai_predictions ap WHERE ap.module='root_cause' AND ap.user_id=$1
         GROUP BY 1 ORDER BY n DESC LIMIT 6`,
                [uid]
            ),
            query(
                `SELECT to_char(date_trunc('month', created_at),'YYYY-MM') ym, COALESCE(SUM(price),0) revenue, COUNT(*)::int sold
         FROM marketplace_listings WHERE seller_id=$1 AND status='sold' GROUP BY 1 ORDER BY 1`,
                [uid]
            ),
        ]);
        res.json({
            metrics: metrics.rows[0] || {
                total_listings: 0,
                total_sold: 0,
                return_rate: 0,
                revenue: 0,
                circular_score: 0
            },
            listings_by_status: listings.rows,
            top_return_root_causes: rootCauses.rows,
            revenue_by_month: revenueByMonth.rows.map((r) => ({
                month: r.ym,
                revenue: Number(r.revenue),
                sold: r.sold
            })),
        });
    })
);

// ---- Enterprise / ESG dashboard ----
router.get(
    "/enterprise",
    requireRole("enterprise", "admin"),
    asyncHandler(async (_req, res) => {
        const [gmv, carbon, returns, monthly] = await Promise.all([
            query("SELECT COALESCE(SUM(price),0) gmv, COUNT(*)::int n FROM marketplace_listings WHERE status='sold'"),
            query("SELECT COALESCE(SUM(carbon_saved_kg),0) carbon, COALESCE(SUM(waste_diverted_kg),0) waste, COALESCE(SUM(water_saved_l),0) water FROM carbon_events"),
            query(
                `SELECT
           (SELECT COUNT(*)::int FROM returns) total_returns,
           (SELECT COUNT(*)::int FROM returns WHERE chosen_path IN ('resell','donate','exchange','repair')) circular_returns`
            ),
            query(
                `SELECT to_char(date_trunc('month', created_at),'YYYY-MM') ym, COALESCE(SUM(carbon_saved_kg),0) carbon
         FROM carbon_events GROUP BY 1 ORDER BY 1`
            ),
        ]);
        const r = returns.rows[0];
        const diversionRate = r.total_returns ? Math.round((r.circular_returns / r.total_returns) * 100) : 0;
        res.json({
            circular_gmv: Number(gmv.rows[0].gmv),
            circular_transactions: gmv.rows[0].n,
            esg: {
                carbon_saved_kg: Number(carbon.rows[0].carbon),
                waste_diverted_kg: Number(carbon.rows[0].waste),
                water_saved_l: Number(carbon.rows[0].water),
            },
            diversion_rate_pct: diversionRate,
            total_returns: r.total_returns,
            circular_returns: r.circular_returns,
            carbon_by_month: monthly.rows.map((m) => ({
                month: m.ym,
                carbon: Number(m.carbon)
            })),
        });
    })
);

// ---- Notifications ----
router.get(
    "/notifications",
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50", [req.user.id]);
        res.json(rows);
    })
);

export default router;