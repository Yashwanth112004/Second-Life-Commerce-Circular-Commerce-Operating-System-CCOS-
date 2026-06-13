import {
    Router
} from "express";
import {
    query
} from "../db/pool.js";
import {
    asyncHandler
} from "../middleware/common.js";

const router = Router();

router.get(
    "/",
    asyncHandler(async (req, res) => {
        const {
            category,
            q
        } = req.query;
        const clauses = [];
        const params = [];
        if (category) {
            params.push(category);
            clauses.push(`category=$${params.length}`);
        }
        if (q) {
            params.push(`%${q}%`);
            clauses.push(`(title ILIKE $${params.length} OR brand ILIKE $${params.length})`);
        }
        const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
        const {
            rows
        } = await query(`SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT 100`, params);
        res.json(rows);
    })
);

router.get(
    "/:id",
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query("SELECT * FROM products WHERE id=$1", [req.params.id]);
        if (!rows[0]) return res.status(404).json({
            error: "Product not found"
        });
        res.json(rows[0]);
    })
);

export default router;