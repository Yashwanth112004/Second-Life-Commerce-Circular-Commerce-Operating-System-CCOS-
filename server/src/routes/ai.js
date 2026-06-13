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
    generateListing
} from "../services/ai/listing.js";
import {
    analyzeRootCause
} from "../services/ai/rootCause.js";
import {
    coach
} from "../services/ai/sustainabilityCoach.js";
import {
    recommendPrice
} from "../services/pricing.js";
import {
    findBuyers
} from "../services/nextBestOwner.js";
import {
    logPrediction
} from "../services/aiLog.js";

const router = Router();
router.use(requireAuth);

async function productForOrder(orderId, userId) {
    const {
        rows
    } = await query(
        `SELECT o.id AS order_id, o.age_months, o.purchase_price, p.*
     FROM orders o JOIN products p ON p.id=o.product_id WHERE o.id=$1 AND o.user_id=$2`,
        [orderId, userId]
    );
    return rows[0];
}

router.post(
    "/listing-generator",
    validateBody(z.object({
        orderId: z.string().uuid(),
        grade: z.enum(["A+", "A", "B", "C", "D"]).default("A")
    })),
    asyncHandler(async (req, res) => {
        const o = await productForOrder(req.body.orderId, req.user.id);
        if (!o) return res.status(404).json({
            error: "Order not found"
        });
        const price = recommendPrice({
            msrp: o.msrp,
            grade: req.body.grade,
            ageMonths: o.age_months,
            category: o.category,
            monthlyDepreciation: o.monthly_depreciation
        });
        const gen = await generateListing({
            product: {
                id: o.id,
                title: o.title,
                brand: o.brand,
                category: o.category,
                msrp: o.msrp
            },
            grade: req.body.grade,
            gradeLabel: {
                "A+": "Like New",
                A: "Excellent",
                B: "Good",
                C: "Fair",
                D: "Parts"
            } [req.body.grade],
            damageNotes: [],
            price: price.recommended_price,
            ageMonths: o.age_months,
        });
        await logPrediction({
            userId: req.user.id,
            module: "listing",
            input: req.body,
            output: gen.result,
            model: gen.model,
            source: gen.source,
            latencyMs: gen.latencyMs
        });
        res.json({
            ...gen.result,
            price: price.recommended_price,
            source: gen.source,
            model: gen.model
        });
    })
);

router.post(
    "/root-cause",
    validateBody(z.object({
        orderId: z.string().uuid(),
        reasonCode: z.string().default("changed_mind"),
        reasonText: z.string().optional(),
        comments: z.string().optional()
    })),
    asyncHandler(async (req, res) => {
        const o = await productForOrder(req.body.orderId, req.user.id);
        if (!o) return res.status(404).json({
            error: "Order not found"
        });
        const rc = await analyzeRootCause({
            product: o,
            reasonCode: req.body.reasonCode,
            reasonText: req.body.reasonText,
            comments: req.body.comments
        });
        await logPrediction({
            userId: req.user.id,
            module: "root_cause",
            input: req.body,
            output: rc.result,
            model: rc.model,
            source: rc.source,
            latencyMs: rc.latencyMs
        });
        res.json({
            ...rc.result,
            source: rc.source,
            model: rc.model
        });
    })
);

router.post(
    "/price",
    validateBody(z.object({
        orderId: z.string().uuid(),
        grade: z.enum(["A+", "A", "B", "C", "D"]).default("A")
    })),
    asyncHandler(async (req, res) => {
        const o = await productForOrder(req.body.orderId, req.user.id);
        if (!o) return res.status(404).json({
            error: "Order not found"
        });
        res.json(recommendPrice({
            msrp: o.msrp,
            grade: req.body.grade,
            ageMonths: o.age_months,
            category: o.category,
            monthlyDepreciation: o.monthly_depreciation
        }));
    })
);

router.post(
    "/match-buyers",
    validateBody(z.object({
        orderId: z.string().uuid(),
        grade: z.enum(["A+", "A", "B", "C", "D"]).default("A")
    })),
    asyncHandler(async (req, res) => {
        const o = await productForOrder(req.body.orderId, req.user.id);
        if (!o) return res.status(404).json({
            error: "Order not found"
        });
        const price = recommendPrice({
            msrp: o.msrp,
            grade: req.body.grade,
            ageMonths: o.age_months,
            category: o.category,
            monthlyDepreciation: o.monthly_depreciation
        });
        const result = await findBuyers(query, {
            orderId: o.order_id,
            category: o.category,
            price: price.recommended_price,
            sellerId: req.user.id,
            sellerCity: req.user.city
        });
        await logPrediction({
            userId: req.user.id,
            module: "nbo",
            input: req.body,
            output: result,
            model: "nboe-v1",
            source: "ai",
            latencyMs: 0
        });
        res.json(result);
    })
);

router.post(
    "/sustainability-coach",
    asyncHandler(async (req, res) => {
        const {
            rows: wr
        } = await query("SELECT * FROM wallets WHERE user_id=$1", [req.user.id]);
        const w = wr[0] || {
            green_credits: 0,
            carbon_saved_kg: 0
        };
        const {
            rows: cat
        } = await query(
            `SELECT p.category, COUNT(*) c FROM carbon_events ce
       JOIN orders o ON o.id=ce.order_id JOIN products p ON p.id=o.product_id
       WHERE ce.user_id=$1 GROUP BY p.category ORDER BY c DESC LIMIT 1`,
            [req.user.id]
        );
        const {
            rows: actions
        } = await query("SELECT DISTINCT action FROM carbon_events WHERE user_id=$1 LIMIT 5", [req.user.id]);
        const out = await coach({
            name: req.user.name,
            carbonKg: Number(w.carbon_saved_kg),
            greenCredits: Number(w.green_credits),
            topCategory: cat[0] && cat[0].category,
            recentActions: actions.map((a) => a.action),
        });
        await logPrediction({
            userId: req.user.id,
            module: "coach",
            input: {},
            output: out.result,
            model: out.model,
            source: out.source,
            latencyMs: out.latencyMs
        });
        res.json({
            ...out.result,
            source: out.source,
            model: out.model
        });
    })
);

export default router;