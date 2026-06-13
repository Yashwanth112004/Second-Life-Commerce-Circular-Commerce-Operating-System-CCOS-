import {
    Router
} from "express";
import {
    z
} from "zod";
import {
    query,
    tx
} from "../db/pool.js";
import {
    requireAuth
} from "../middleware/auth.js";
import {
    asyncHandler,
    validateBody
} from "../middleware/common.js";
import {
    scanInventory
} from "../services/araAgent.js";
import {
    productTwin
} from "../services/twin.js";
import {
    generateListing
} from "../services/ai/listing.js";
import {
    findBuyers
} from "../services/nextBestOwner.js";
import {
    logPrediction
} from "../services/aiLog.js";

const router = Router();
router.use(requireAuth);

router.get(
    "/status",
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query("SELECT ara_enabled FROM users WHERE id=$1", [req.user.id]);
        res.json({
            enabled: rows[0] ? rows[0].ara_enabled : false
        });
    })
);

router.post(
    "/toggle",
    validateBody(z.object({
        enabled: z.boolean()
    })),
    asyncHandler(async (req, res) => {
        await query("UPDATE users SET ara_enabled=$2 WHERE id=$1", [req.user.id, req.body.enabled]);
        res.json({
            enabled: req.body.enabled
        });
    })
);

router.get(
    "/suggestions",
    asyncHandler(async (req, res) => {
        const plan = await scanInventory(query, req.user);
        res.json(plan);
    })
);

// Autonomous action: the agent lists an owned item for resale (AI listing + twin price + buyers).
router.post(
    "/list",
    validateBody(z.object({
        orderId: z.string().uuid()
    })),
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query(
            `SELECT o.*, p.title, p.brand, p.category, p.msrp, p.monthly_depreciation
       FROM orders o JOIN products p ON p.id=o.product_id WHERE o.id=$1 AND o.user_id=$2`,
            [req.body.orderId, req.user.id]
        );
        const o = rows[0];
        if (!o) return res.status(404).json({
            error: "Order not found"
        });
        if (o.status !== "owned") return res.status(409).json({
            error: "Item is not available to list"
        });

        const twin = productTwin({
            msrp: o.msrp,
            grade: "B",
            ageMonths: o.age_months,
            category: o.category,
            monthlyDepreciation: o.monthly_depreciation
        });
        const product = {
            id: o.product_id,
            title: o.title,
            brand: o.brand,
            category: o.category,
            msrp: o.msrp
        };
        const gen = await generateListing({
            product,
            grade: "B",
            gradeLabel: "Good",
            damageNotes: [],
            price: twin.current_value,
            ageMonths: o.age_months,
        });
        await logPrediction({
            userId: req.user.id,
            module: "listing",
            input: {
                orderId: o.id,
                via: "ara"
            },
            output: gen.result,
            model: gen.model,
            source: gen.source,
            latencyMs: gen.latencyMs
        });

        const listing = await tx(async (c) => {
            const {
                rows: lrows
            } = await c.query(
                `INSERT INTO marketplace_listings (order_id, product_id, seller_id, marketplace, title, description, price, condition_grade, keywords, features, status)
         VALUES ($1,$2,$3,'certified_preloved',$4,$5,$6,'B',$7,$8,'active') RETURNING *`,
                [o.id, o.product_id, req.user.id, gen.result.title, gen.result.description, twin.current_value, JSON.stringify(gen.result.keywords), JSON.stringify(gen.result.features)]
            );
            await c.query("UPDATE orders SET status='listed' WHERE id=$1", [o.id]);
            await c.query(`INSERT INTO product_passports (order_id, event_type, detail, actor) VALUES ($1,'resale',$2,'Autonomous Resale Agent')`,
                [o.id, JSON.stringify({
                    price: twin.current_value,
                    via: "ARA"
                })]);
            return lrows[0];
        });

        const buyers = await findBuyers(query, {
            orderId: o.id,
            listingId: listing.id,
            category: o.category,
            price: twin.current_value,
            sellerId: req.user.id,
            sellerCity: req.user.city,
        });
        for (const b of buyers.matches) {
            await query(
                `INSERT INTO buyer_matches (listing_id, order_id, buyer_id, buyer_label, location, distance_miles, match_score, conversion_probability, predicted_days_to_sale)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [listing.id, o.id, b.buyer_id, b.buyer_label, b.location, b.distance_miles, b.match_score, b.conversion_probability, b.predicted_days_to_sale]
            );
        }
        await query(`INSERT INTO notifications (user_id, kind, title, body) VALUES ($1,'ara','Agent listed an item',$2)`,
            [req.user.id, `${o.title} is now listed at $${twin.current_value} with ${buyers.matches.length} buyer matches.`]);

        res.status(201).json({
            listing: {
                ...listing,
                ...gen.result,
                ai_source: gen.source
            },
            twin,
            buyer_matches: buyers
        });
    })
);

export default router;