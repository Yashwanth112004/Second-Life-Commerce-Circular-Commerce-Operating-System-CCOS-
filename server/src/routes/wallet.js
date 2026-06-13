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
    levelForBalance,
    nextLevel
} from "../services/greenCredits.js";

const router = Router();
router.use(requireAuth);

router.get(
    "/",
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query("SELECT * FROM wallets WHERE user_id=$1", [req.user.id]);
        const w = rows[0] || {
            green_credits: 0,
            carbon_saved_kg: 0,
            water_saved_l: 0,
            waste_diverted_kg: 0
        };
        res.json({
            ...w,
            cash_value_usd: Math.round(Number(w.green_credits) * 0.1 * 100) / 100,
            level: levelForBalance(Number(w.green_credits)),
            next_level: nextLevel(Number(w.green_credits)),
        });
    })
);

router.get(
    "/history",
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query(
            "SELECT delta, reason, action, balance_after, created_at FROM green_credit_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
            [req.user.id]
        );
        res.json(rows);
    })
);

export default router;