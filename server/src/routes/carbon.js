import {
    Router
} from "express";
import {
    query
} from "../db/pool.js";
import {
    requireAuth
} from "../middleware/auth.js";
import {
    asyncHandler
} from "../middleware/common.js";
import {
    equivalents
} from "../services/carbon.js";

const router = Router();
router.use(requireAuth);

router.get(
    "/report",
    asyncHandler(async (req, res) => {
        const {
            rows: totals
        } = await query(
            `SELECT COALESCE(SUM(carbon_saved_kg),0) carbon, COALESCE(SUM(water_saved_l),0) water,
              COALESCE(SUM(waste_diverted_kg),0) waste, COALESCE(SUM(manufacturing_avoided_kg),0) mfg,
              COUNT(*)::int events
       FROM carbon_events WHERE user_id=$1`,
            [req.user.id]
        );
        const {
            rows: byAction
        } = await query(
            `SELECT action, COALESCE(SUM(carbon_saved_kg),0) carbon, COUNT(*)::int n
       FROM carbon_events WHERE user_id=$1 GROUP BY action ORDER BY carbon DESC`,
            [req.user.id]
        );
        const {
            rows: timeline
        } = await query(
            `SELECT to_char(date_trunc('month', created_at),'YYYY-MM') ym,
              COALESCE(SUM(carbon_saved_kg),0) carbon
       FROM carbon_events WHERE user_id=$1 GROUP BY 1 ORDER BY 1`,
            [req.user.id]
        );
        const t = totals[0];
        res.json({
            totals: {
                carbon_saved_kg: Number(t.carbon),
                water_saved_l: Number(t.water),
                waste_diverted_kg: Number(t.waste),
                manufacturing_avoided_kg: Number(t.mfg),
                events: t.events,
            },
            equivalents: equivalents(Number(t.carbon)),
            by_action: byAction.map((r) => ({
                action: r.action,
                carbon: Number(r.carbon),
                count: r.n
            })),
            timeline: timeline.map((r) => ({
                month: r.ym,
                carbon: Number(r.carbon)
            })),
        });
    })
);

export default router;