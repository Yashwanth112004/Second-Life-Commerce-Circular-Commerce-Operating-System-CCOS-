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
    productTwin
} from "../services/twin.js";
import {
    computeCES
} from "../services/ces.js";

const router = Router();

const GRADE_BONUS = {
    "A+": 30,
    A: 24,
    B: 18,
    C: 10,
    D: 4,
    F: 0
};
const STORY = {
    manufactured: {
        title: "Manufactured",
        icon: "🏭"
    },
    first_sale: {
        title: "First purchased",
        icon: "🛒"
    },
    inspection: {
        title: "AI-inspected",
        icon: "🔍"
    },
    repair: {
        title: "Repaired",
        icon: "🔧"
    },
    ownership_transfer: {
        title: "New owner",
        icon: "🔄"
    },
    resale: {
        title: "Given a second life (resold)",
        icon: "♻️"
    },
    donation: {
        title: "Donated",
        icon: "🎁"
    },
    end_of_life: {
        title: "Responsibly recycled",
        icon: "🌱"
    },
};

// Public passport lookup by order (the physical unit's full lifecycle).
router.get(
    "/:orderId",
    asyncHandler(async (req, res) => {
        const {
            rows: orows
        } = await query(
            `SELECT o.id, o.order_number, o.status, o.purchased_at, o.age_months, o.purchase_price,
              p.title, p.brand, p.category, p.msrp, p.image_url, p.embedded_carbon_kg,
              p.weight_kg, p.monthly_depreciation, p.eco_score
       FROM orders o JOIN products p ON p.id=o.product_id WHERE o.id=$1`,
            [req.params.orderId]
        );
        if (!orows[0]) return res.status(404).json({
            error: "Item not found"
        });
        const o = orows[0];

        const [events, owners, repairs, assess, carbon] = await Promise.all([
            query("SELECT event_type, detail, actor, created_at FROM product_passports WHERE order_id=$1 ORDER BY created_at ASC", [o.id]),
            query("SELECT owner_label, acquired_at FROM ownership_history WHERE order_id=$1 ORDER BY acquired_at ASC", [o.id]),
            query("SELECT repair_type, parts_replaced, technician, cost, created_at FROM repair_history WHERE order_id=$1 ORDER BY created_at ASC", [o.id]),
            query("SELECT grade, grade_label, confidence, model, created_at FROM return_assessments WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1", [o.id]),
            query("SELECT action, carbon_saved_kg, created_at FROM carbon_events WHERE order_id=$1 ORDER BY created_at ASC", [o.id]),
        ]);

        const grade = assess.rows[0] ? assess.rows[0].grade : null;
        const ownershipCount = Math.max(owners.rows.length, 1);
        const repairCount = repairs.rows.length;

        // Lifecycle score: base + event richness + condition.
        const lifecycleScore = Math.max(0, Math.min(100,
            40 + Math.min(events.rows.length * 5, 30) + (grade ? GRADE_BONUS[grade] || 10 : 12)
        ));

        // Carbon history (cumulative).
        let cum = 0;
        const carbonHistory = carbon.rows.map((c) => {
            cum += Number(c.carbon_saved_kg);
            return {
                date: c.created_at,
                action: c.action,
                carbon_saved_kg: Number(c.carbon_saved_kg),
                cumulative_kg: Math.round(cum * 100) / 100
            };
        });

        // Value history + twin forecast.
        const twin = productTwin({
            msrp: o.msrp,
            grade: grade || "B",
            ageMonths: o.age_months,
            category: o.category,
            monthlyDepreciation: o.monthly_depreciation,
        });
        const valueHistory = [{
                label: "MSRP (new)",
                value: Number(o.msrp)
            },
            {
                label: "Paid",
                value: Number(o.purchase_price)
            },
            {
                label: "Now",
                value: twin.current_value
            },
            {
                label: "+3 mo",
                value: twin.forecast.m3
            },
            {
                label: "+6 mo",
                value: twin.forecast.m6
            },
            {
                label: "+12 mo",
                value: twin.forecast.m12
            },
        ];

        // Story timeline (narrative).
        const story = events.rows.map((e) => {
            const meta = STORY[e.event_type] || {
                title: e.event_type,
                icon: "•"
            };
            return {
                title: meta.title,
                icon: meta.icon,
                actor: e.actor,
                date: e.created_at,
                detail: e.detail
            };
        });

        const ces = computeCES({
            category: o.category,
            ecoScore: o.eco_score,
            grade: grade || "B",
            ageMonths: o.age_months
        });

        res.json({
            order: o,
            current_grade: grade,
            grade_label: assess.rows[0] ? assess.rows[0].grade_label : null,
            inspection: assess.rows[0] || null,
            ces,
            lifecycle_score: lifecycleScore,
            ownership_count: ownershipCount,
            repair_count: repairCount,
            total_carbon_saved_kg: Math.round(cum * 100) / 100,
            twin,
            carbon_history: carbonHistory,
            value_history: valueHistory,
            events: events.rows,
            ownership_history: owners.rows,
            repair_history: repairs.rows,
            story,
        });
    })
);

export default router;