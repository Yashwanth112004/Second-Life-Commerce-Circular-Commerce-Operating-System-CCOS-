import {
    Router
} from "express";
import {
    query
} from "../db/pool.js";
import {
    asyncHandler
} from "../middleware/common.js";
import {
    equivalents
} from "../services/carbon.js";
import {
    scoreAllUsers
} from "../services/circularScore.js";

const router = Router();

// Public, demo-ready platform impact snapshot. No auth.
router.get(
    "/",
    asyncHandler(async (_req, res) => {
        const [totals, secondLife, mostImpactful, recent, inspections, leaderboard] = await Promise.all([
            query(`SELECT COALESCE(SUM(carbon_saved_kg),0) carbon, COALESCE(SUM(water_saved_l),0) water,
                     COALESCE(SUM(waste_diverted_kg),0) waste, COUNT(*)::int events FROM carbon_events`),
            query(`SELECT
               (SELECT COUNT(*)::int FROM marketplace_listings) listed,
               (SELECT COUNT(*)::int FROM marketplace_listings WHERE status='sold') sold,
               (SELECT COUNT(*)::int FROM donations) donated,
               (SELECT COUNT(*)::int FROM returns WHERE chosen_path='resell') resold`),
            query(`SELECT p.title, p.brand, p.image_url, COALESCE(SUM(c.carbon_saved_kg),0) carbon
             FROM carbon_events c JOIN orders o ON o.id=c.order_id JOIN products p ON p.id=o.product_id
             GROUP BY p.id ORDER BY carbon DESC LIMIT 1`),
            query(`SELECT c.action, c.carbon_saved_kg, c.created_at, p.title, u.name AS user_name, u.city
             FROM carbon_events c JOIN orders o ON o.id=c.order_id JOIN products p ON p.id=o.product_id
             JOIN users u ON u.id=c.user_id ORDER BY c.created_at DESC LIMIT 8`),
            query(`SELECT ra.grade, ra.grade_label, ra.confidence, ra.model, ra.created_at, p.title
             FROM return_assessments ra JOIN orders o ON o.id=ra.order_id JOIN products p ON p.id=o.product_id
             WHERE ra.source IN ('vision','vision_fallback') ORDER BY ra.created_at DESC LIMIT 6`),
            scoreAllUsers(query),
        ]);

        const t = totals.rows[0];
        const sl = secondLife.rows[0];
        res.json({
            totals: {
                carbon_saved_kg: Number(t.carbon),
                water_saved_l: Number(t.water),
                waste_diverted_kg: Number(t.waste),
                circular_events: t.events,
            },
            equivalents: equivalents(Number(t.carbon)),
            products_given_second_life: sl.sold + sl.donated + sl.resold,
            second_life_breakdown: {
                listed: sl.listed,
                sold: sl.sold,
                donated: sl.donated,
                resold: sl.resold
            },
            most_impactful_product: mostImpactful.rows[0] || null,
            top_circular_users: leaderboard.slice(0, 5).map((u, i) => ({
                rank: i + 1,
                name: u.name,
                city: u.city,
                score: u.score,
                tier: u.tier
            })),
            recent_activity: recent.rows.map((r) => ({
                action: r.action,
                product: r.title,
                user: r.user_name,
                city: r.city,
                carbon_saved_kg: Number(r.carbon_saved_kg),
                at: r.created_at,
            })),
            live_inspections: inspections.rows.map((r) => ({
                product: r.title,
                grade: r.grade,
                grade_label: r.grade_label,
                confidence: Number(r.confidence),
                model: r.model,
                at: r.created_at,
            })),
        });
    })
);

export default router;