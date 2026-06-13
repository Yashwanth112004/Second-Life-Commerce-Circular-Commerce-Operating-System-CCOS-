import {
    Router
} from "express";
import {
    z
} from "zod";
import {
    query
} from "../db/pool.js";
import {
    requireAuth
} from "../middleware/auth.js";
import {
    asyncHandler,
    validateBody
} from "../middleware/common.js";
import {
    levelForBalance,
    nextLevel
} from "../services/greenCredits.js";
import {
    recommendPrice
} from "../services/pricing.js";

const router = Router();
router.use(requireAuth);

router.get(
    "/me",
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query("SELECT * FROM wallets WHERE user_id=$1", [req.user.id]);
        const w = rows[0] || {
            green_credits: 0,
            carbon_saved_kg: 0
        };
        res.json({
            ...req.user,
            wallet: w,
            level: levelForBalance(w.green_credits),
            next_level: nextLevel(w.green_credits),
        });
    })
);

router.patch(
    "/me",
    validateBody(z.object({
        name: z.string().min(2).optional(),
        city: z.string().optional()
    })),
    asyncHandler(async (req, res) => {
        const {
            name,
            city
        } = req.body;
        const {
            rows
        } = await query(
            `UPDATE users SET name=COALESCE($2,name), city=COALESCE($3,city), updated_at=now()
       WHERE id=$1 RETURNING id,email,name,role,city,is_prime`,
            [req.user.id, name || null, city || null]
        );
        res.json(rows[0]);
    })
);

// Owned inventory with a live estimated current value (DCPE).
router.get(
    "/me/orders",
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query(
            `SELECT o.*, p.title, p.brand, p.category, p.msrp, p.image_url, p.monthly_depreciation
       FROM orders o JOIN products p ON p.id=o.product_id
       WHERE o.user_id=$1 ORDER BY o.purchased_at DESC`,
            [req.user.id]
        );
        res.json(
            rows.map((o) => {
                const est = recommendPrice({
                    msrp: o.msrp,
                    grade: "A",
                    ageMonths: o.age_months,
                    category: o.category,
                    monthlyDepreciation: o.monthly_depreciation,
                });
                return {
                    id: o.id,
                    order_number: o.order_number,
                    status: o.status,
                    purchase_price: o.purchase_price,
                    purchased_at: o.purchased_at,
                    age_months: o.age_months,
                    estimated_value: est.recommended_price,
                    product: {
                        id: o.product_id,
                        title: o.title,
                        brand: o.brand,
                        category: o.category,
                        msrp: o.msrp,
                        image_url: o.image_url,
                    },
                };
            })
        );
    })
);

export default router;