import {
    Router
} from "express";
import PDFDocument from "pdfkit";
import {
    query
} from "../db/pool.js";
import {
    requireAuth
} from "../middleware/auth.js";
import {
    asyncHandler
} from "../middleware/common.js";

const router = Router();

const STAGES = ["received", "verified", "distributed", "in_use"];
const STAGE_LABEL = {
    received: "Received by NGO",
    verified: "Verified & sorted",
    distributed: "Distributed to community",
    in_use: "In use / impact realized",
};

router.use(requireAuth);

// Donor's donations with impact chain.
router.get(
    "/",
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query(
            `SELECT d.*, p.title, p.image_url FROM donations d
       JOIN orders o ON o.id=d.order_id JOIN products p ON p.id=o.product_id
       WHERE d.donor_id=$1 ORDER BY d.created_at DESC`,
            [req.user.id]
        );
        res.json(rows.map((d) => ({
            id: d.id,
            ngo_name: d.ngo_name,
            fair_market_value: d.fair_market_value,
            tax_receipt_id: d.tax_receipt_id,
            impact_stage: d.impact_stage,
            impact_detail: d.impact_detail,
            product: {
                title: d.title,
                image_url: d.image_url
            },
            created_at: d.created_at,
            chain: STAGES.map((s) => ({
                stage: s,
                label: STAGE_LABEL[s],
                reached: STAGES.indexOf(s) <= STAGES.indexOf(d.impact_stage)
            })),
        })));
    })
);

// Advance the impact chain (received -> verified -> distributed -> in_use).
router.post(
    "/:id/advance",
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query("SELECT * FROM donations WHERE id=$1 AND donor_id=$2", [req.params.id, req.user.id]);
        const d = rows[0];
        if (!d) return res.status(404).json({
            error: "Donation not found"
        });
        const next = STAGES[Math.min(STAGES.indexOf(d.impact_stage) + 1, STAGES.length - 1)];
        const {
            rows: upd
        } = await query(
            "UPDATE donations SET impact_stage=$2 WHERE id=$1 RETURNING impact_stage, impact_detail",
            [d.id, next]
        );
        res.json({
            impact_stage: upd[0].impact_stage,
            label: STAGE_LABEL[next]
        });
    })
);

// Downloadable tax receipt (PDF).
router.get(
    "/:id/receipt.pdf",
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query(
            `SELECT d.*, p.title, u.name AS donor_name FROM donations d
       JOIN orders o ON o.id=d.order_id JOIN products p ON p.id=o.product_id
       JOIN users u ON u.id=d.donor_id WHERE d.id=$1 AND d.donor_id=$2`,
            [req.params.id, req.user.id]
        );
        const d = rows[0];
        if (!d) return res.status(404).json({
            error: "Donation not found"
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="tax-receipt-${d.tax_receipt_id}.pdf"`);
        const doc = new PDFDocument({
            margin: 56
        });
        doc.pipe(res);
        doc.fontSize(20).fillColor("#16a34a").text("Second Life Commerce", {
            continued: false
        });
        doc.moveDown(0.2).fontSize(12).fillColor("#444").text("Charitable Donation Tax Receipt");
        doc.moveDown();
        doc.fillColor("#000").fontSize(11);
        const line = (k, v) => doc.text(`${k}: `, {
            continued: true
        }).fillColor("#000").font("Helvetica-Bold").text(String(v)).font("Helvetica").fillColor("#000");
        doc.font("Helvetica");
        line("Receipt ID", d.tax_receipt_id);
        line("Date", new Date(d.created_at).toLocaleDateString());
        line("Donor", d.donor_name);
        line("Recipient organization", d.ngo_name);
        line("Donated item", d.title);
        line("Fair market value (USD)", `$${d.fair_market_value}`);
        line("Impact stage", STAGE_LABEL[d.impact_stage] || d.impact_stage);
        if (d.impact_detail && d.impact_detail.est_meals) line("Estimated community impact", `${d.impact_detail.est_meals} meals equivalent`);
        doc.moveDown();
        doc.fontSize(9).fillColor("#666").text("This receipt acknowledges a non-cash charitable contribution facilitated by Second Life Commerce. No goods or services were provided in exchange. Consult a tax professional for deductibility.", {
            width: 460
        });
        doc.end();
    })
);

export default router;