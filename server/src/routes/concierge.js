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
    buildRecommendations
} from "../services/concierge.js";

const router = Router();
router.use(requireAuth);

// Proactive recommendations — analyzed automatically on login.
router.get(
    "/",
    asyncHandler(async (req, res) => {
        const result = await buildRecommendations(query, req.user);
        res.json(result);
    })
);

// Agent activity feed — derived from real persistent events.
router.get(
    "/activity",
    asyncHandler(async (req, res) => {
        const uid = req.user.id;
        const [counts, feed] = await Promise.all([
            query(`
        SELECT
          (SELECT COUNT(*)::int FROM marketplace_listings WHERE seller_id=$1) listings_generated,
          (SELECT COUNT(*)::int FROM buyer_matches bm JOIN orders o ON o.id=bm.order_id WHERE o.user_id=$1) buyer_matches_found,
          (SELECT COUNT(*)::int FROM donations WHERE donor_id=$1) donations_made,
          (SELECT COUNT(*)::int FROM product_passports pp JOIN orders o ON o.id=pp.order_id WHERE o.user_id=$1 AND pp.actor='Autonomous Resale Agent') ara_listings
      `, [uid]),
            query(`
        SELECT kind, title, body, created_at FROM notifications WHERE user_id=$1
        ORDER BY created_at DESC LIMIT 12
      `, [uid]),
        ]);

        const c = counts.rows[0];
        res.json({
            enabled: req.user.ara_enabled,
            last_scan: new Date().toISOString(),
            stats: {
                listings_generated: c.listings_generated,
                buyer_matches_found: c.buyer_matches_found,
                donations_made: c.donations_made,
                ara_listings: c.ara_listings,
            },
            feed: feed.rows.map((f) => ({
                kind: f.kind,
                title: f.title,
                body: f.body,
                at: f.created_at
            })),
        });
    })
);

export default router;