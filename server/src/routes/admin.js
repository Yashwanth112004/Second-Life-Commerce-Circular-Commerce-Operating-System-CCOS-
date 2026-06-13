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
router.use(requireAuth, requireRole("admin"));

router.get("/users", asyncHandler(async (_req, res) => {
    const {
        rows
    } = await query("SELECT id,email,name,role,city,created_at FROM users ORDER BY created_at DESC LIMIT 200");
    res.json(rows);
}));

router.get("/listings", asyncHandler(async (_req, res) => {
    const {
        rows
    } = await query(
        `SELECT ml.id, ml.title, ml.price, ml.status, ml.marketplace, u.email seller
     FROM marketplace_listings ml JOIN users u ON u.id=ml.seller_id ORDER BY ml.created_at DESC LIMIT 200`
    );
    res.json(rows);
}));

router.patch("/listings/:id/moderate", asyncHandler(async (req, res) => {
    const status = (req.body && req.body.status) === "removed" ? "removed" : "active";
    const {
        rows
    } = await query("UPDATE marketplace_listings SET status=$2 WHERE id=$1 RETURNING id,status", [req.params.id, status]);
    if (!rows[0]) return res.status(404).json({
        error: "Listing not found"
    });
    res.json(rows[0]);
}));

router.get("/fraud", asyncHandler(async (_req, res) => {
    const {
        rows
    } = await query("SELECT * FROM fraud_cases ORDER BY created_at DESC LIMIT 200");
    res.json(rows);
}));

router.get("/ai-logs", asyncHandler(async (req, res) => {
    const {
        module
    } = req.query;
    const {
        rows
    } = await query(
        `SELECT id, module, model, source, latency_ms, created_at, user_id
     FROM ai_predictions ${module ? "WHERE module=$1" : ""} ORDER BY created_at DESC LIMIT 200`,
        module ? [module] : []
    );
    res.json(rows);
}));

router.get("/analytics", asyncHandler(async (_req, res) => {
    const [counts, risks, categories, products] = await Promise.all([
        query(`
            SELECT
              (SELECT COUNT(*)::int FROM users) users,
              (SELECT COUNT(*)::int FROM orders) orders,
              (SELECT COUNT(*)::int FROM returns) returns,
              (SELECT COUNT(*)::int FROM marketplace_listings) listings,
              (SELECT COUNT(*)::int FROM ai_predictions) ai_calls,
              (SELECT COUNT(*)::int FROM ai_predictions WHERE source='ai') ai_real,
              (SELECT COALESCE(SUM(carbon_saved_kg),0) FROM carbon_events) carbon
        `),
        query(`
            SELECT COALESCE(output->>'riskLevel', 'LOW') AS risk_level, COUNT(*)::int AS count 
            FROM ai_predictions WHERE module='return_intent' GROUP BY 1
        `),
        query(`
            SELECT COALESCE(input->>'category', 'unknown') AS category, ROUND(AVG((output->>'returnProbability')::numeric), 1)::float AS avg_probability 
            FROM ai_predictions WHERE module='return_intent' AND output->>'returnProbability' IS NOT NULL GROUP BY 1 ORDER BY avg_probability DESC
        `),
        query(`
            SELECT COALESCE(input->>'productId', 'unknown') AS product_id, MAX(input->>'brand') AS brand, MAX(input->>'category') AS category, ROUND(AVG((output->>'returnProbability')::numeric), 1)::float AS avg_probability 
            FROM ai_predictions WHERE module='return_intent' AND output->>'returnProbability' IS NOT NULL GROUP BY 1 ORDER BY avg_probability DESC LIMIT 10
        `)
    ]);

    res.json({
        ...counts.rows[0],
        risk_distribution: risks.rows,
        category_risk: categories.rows,
        product_risk: products.rows
    });
}));

export default router;