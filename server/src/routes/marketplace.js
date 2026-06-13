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
    calculateCarbon
} from "../services/carbon.js";
import {
    creditsForAction,
    awardCredits
} from "../services/greenCredits.js";

const router = Router();

const CHANNELS = [{
        id: "certified_preloved",
        name: "Certified Preloved",
        desc: "AI-graded used products with full condition disclosure"
    },
    {
        id: "rental",
        name: "Rental",
        desc: "Rent for days, weeks, or months"
    },
    {
        id: "exchange",
        name: "Exchange",
        desc: "Direct item swaps — no money changes hands"
    },
    {
        id: "donation",
        name: "Donation",
        desc: "Match donors with verified NGOs"
    },
    {
        id: "parts",
        name: "Parts & Materials",
        desc: "Harvest value from end-of-life products"
    },
    {
        id: "p2p",
        name: "Peer-to-Peer Resale",
        desc: "C2C resale inside trusted rails"
    },
];

router.get("/channels", (_req, res) => res.json(CHANNELS));

// Public search with filtering / sorting / pagination.
router.get(
    "/search",
    asyncHandler(async (req, res) => {
        const {
            q,
            category,
            marketplace,
            grade,
            minPrice,
            maxPrice,
            sort = "newest",
            page = "1",
            pageSize = "12"
        } = req.query;
        const params = [];
        const clauses = ["ml.status='active'"];
        const p = (val) => {
            params.push(val);
            return `$${params.length}`;
        };

        if (q) clauses.push(`(ml.title ILIKE ${p(`%${q}%`)} OR p.brand ILIKE ${p(`%${q}%`)})`);
        if (category) clauses.push(`p.category=${p(category)}`);
        if (marketplace) clauses.push(`ml.marketplace=${p(marketplace)}`);
        if (grade) clauses.push(`ml.condition_grade=${p(grade)}`);
        if (minPrice) clauses.push(`ml.price>=${p(Number(minPrice))}`);
        if (maxPrice) clauses.push(`ml.price<=${p(Number(maxPrice))}`);

        const orderBy = {
            newest: "ml.created_at DESC",
            price_asc: "ml.price ASC",
            price_desc: "ml.price DESC",
            popular: "ml.views DESC"
        } [sort] || "ml.created_at DESC";
        const limit = Math.min(parseInt(pageSize, 10) || 12, 48);
        const offset = ((parseInt(page, 10) || 1) - 1) * limit;

        const where = `WHERE ${clauses.join(" AND ")}`;
        const {
            rows: countRows
        } = await query(`SELECT COUNT(*)::int AS total FROM marketplace_listings ml JOIN products p ON p.id=ml.product_id ${where}`, params);
        const {
            rows
        } = await query(
            `SELECT ml.*, p.title AS product_title, p.brand, p.category, p.msrp, p.image_url, p.eco_score,
              u.city AS seller_city,
              COALESCE(AVG(rv.rating),0)::numeric(3,2) AS avg_rating, COUNT(rv.id)::int AS review_count
       FROM marketplace_listings ml
       JOIN products p ON p.id=ml.product_id
       JOIN users u ON u.id=ml.seller_id
       LEFT JOIN reviews rv ON rv.listing_id=ml.id
       ${where}
       GROUP BY ml.id, p.title, p.brand, p.category, p.msrp, p.image_url, p.eco_score, u.city
       ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
            params
        );
        res.json({
            total: countRows[0].total,
            page: parseInt(page, 10) || 1,
            page_size: limit,
            results: rows.map((r) => ({
                ...r,
                savings_pct: r.msrp ? Math.round((1 - r.price / r.msrp) * 100) : 0,
            })),
        });
    })
);

router.get(
    "/listing/:id",
    asyncHandler(async (req, res) => {
        await query("UPDATE marketplace_listings SET views=views+1 WHERE id=$1", [req.params.id]);
        const {
            rows
        } = await query(
            `SELECT ml.*, p.title AS product_title, p.brand, p.category, p.msrp, p.image_url, p.eco_score, u.name AS seller_name, u.city AS seller_city
       FROM marketplace_listings ml JOIN products p ON p.id=ml.product_id JOIN users u ON u.id=ml.seller_id
       WHERE ml.id=$1`,
            [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({
            error: "Listing not found"
        });
        const {
            rows: reviews
        } = await query(
            `SELECT rv.*, u.name AS reviewer_name FROM reviews rv JOIN users u ON u.id=rv.reviewer_id WHERE listing_id=$1 ORDER BY created_at DESC`,
            [req.params.id]
        );
        res.json({
            ...rows[0],
            reviews
        });
    })
);

// Authenticated actions below
router.use(requireAuth);

const listSchema = z.object({
    productId: z.string().uuid(),
    marketplace: z.enum(["certified_preloved", "rental", "exchange", "donation", "parts", "p2p"]).default("certified_preloved"),
    title: z.string().min(3),
    description: z.string().optional(),
    price: z.number().nonnegative(),
    conditionGrade: z.enum(["A+", "A", "B", "C", "D"]).default("A"),
    keywords: z.array(z.string()).optional(),
});

router.post(
    "/list",
    validateBody(listSchema),
    asyncHandler(async (req, res) => {
        const b = req.body;
        const {
            rows
        } = await query(
            `INSERT INTO marketplace_listings (product_id, seller_id, marketplace, title, description, price, condition_grade, keywords)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [b.productId, req.user.id, b.marketplace, b.title, b.description || "", b.price, b.conditionGrade, JSON.stringify(b.keywords || [])]
        );
        res.status(201).json(rows[0]);
    })
);

// Buy a preloved listing — buyer earns Green Credits + carbon (buy_preloved).
router.post(
    "/buy/:id",
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query(
            `SELECT ml.*, p.embedded_carbon_kg, p.weight_kg FROM marketplace_listings ml JOIN products p ON p.id=ml.product_id WHERE ml.id=$1`,
            [req.params.id]
        );
        const listing = rows[0];
        if (!listing) return res.status(404).json({
            error: "Listing not found"
        });
        if (listing.status !== "active") return res.status(409).json({
            error: "Listing is not available"
        });
        if (listing.seller_id === req.user.id) return res.status(400).json({
            error: "You cannot buy your own listing"
        });

        const carbon = calculateCarbon({
            embeddedCarbonKg: listing.embedded_carbon_kg,
            weightKg: listing.weight_kg,
            grade: listing.condition_grade,
            route: "regional_warehouse",
            action: "buy_preloved",
        });
        const gc = creditsForAction("buy_preloved", carbon.carbon_saved_kg);

        const out = await tx(async (c) => {
            await c.query("UPDATE marketplace_listings SET status='sold' WHERE id=$1", [req.params.id]);
            if (listing.order_id) {
                await c.query("UPDATE orders SET status='sold', user_id=$2 WHERE id=$1", [listing.order_id, req.user.id]);
                await c.query(`INSERT INTO ownership_history (order_id, owner_id, owner_label) VALUES ($1,$2,$3)`,
                    [listing.order_id, req.user.id, req.user.name]);
                await c.query(`INSERT INTO product_passports (order_id, event_type, detail, actor) VALUES ($1,'ownership_transfer',$2,'Second Life Commerce')`,
                    [listing.order_id, JSON.stringify({
                        to: req.user.id,
                        price: listing.price
                    })]);
            }
            await c.query(
                `INSERT INTO carbon_events (user_id, order_id, action, carbon_saved_kg, manufacturing_avoided_kg)
         VALUES ($1,$2,'buy_preloved',$3,$4)`,
                [req.user.id, listing.order_id, carbon.carbon_saved_kg, carbon.manufacturing_avoided_kg]
            );
            await c.query(`UPDATE wallets SET carbon_saved_kg=carbon_saved_kg+$2 WHERE user_id=$1`, [req.user.id, carbon.carbon_saved_kg]);
            const credit = await awardCredits(c, {
                userId: req.user.id,
                delta: gc,
                reason: `Bought preloved: ${listing.title}`,
                action: "buy_preloved"
            });
            // Credit the seller's revenue metric.
            await c.query(
                `UPDATE seller_metrics SET total_sold=total_sold+1, revenue=revenue+$2, updated_at=now() WHERE seller_id=$1`,
                [listing.seller_id, listing.price]
            );
            return {
                credit
            };
        });

        res.json({
            ok: true,
            carbon,
            green_credits_earned: gc,
            new_gc_balance: out.credit.balance
        });
    })
);

router.post(
    "/listing/:id/review",
    validateBody(z.object({
        rating: z.number().int().min(1).max(5),
        body: z.string().optional()
    })),
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query(
            `INSERT INTO reviews (listing_id, reviewer_id, rating, body) VALUES ($1,$2,$3,$4) RETURNING *`,
            [req.params.id, req.user.id, req.body.rating, req.body.body || ""]
        );
        res.status(201).json(rows[0]);
    })
);

router.post(
    "/listing/:id/message",
    validateBody(z.object({
        body: z.string().min(1)
    })),
    asyncHandler(async (req, res) => {
        const {
            rows: lr
        } = await query("SELECT seller_id FROM marketplace_listings WHERE id=$1", [req.params.id]);
        if (!lr[0]) return res.status(404).json({
            error: "Listing not found"
        });
        const {
            rows
        } = await query(
            `INSERT INTO messages (listing_id, sender_id, recipient_id, body) VALUES ($1,$2,$3,$4) RETURNING *`,
            [req.params.id, req.user.id, lr[0].seller_id, req.body.body]
        );
        await query(`INSERT INTO notifications (user_id, kind, title, body) VALUES ($1,'message','New message about your listing',$2)`,
            [lr[0].seller_id, req.body.body.slice(0, 120)]);
        res.status(201).json(rows[0]);
    })
);

export default router;