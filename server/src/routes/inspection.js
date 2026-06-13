import {
    Router
} from "express";
import {
    join,
    basename
} from "node:path";
import {
    existsSync
} from "node:fs";
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
import {
    UPLOAD_DIR
} from "../middleware/upload.js";
import { generateRefurbishInstructions } from "../services/ai/refurbishInstructions.js";

const router = Router();
router.use(requireAuth);

async function loadInspection(returnId, userId) {
    const {
        rows: r
    } = await query(
        `SELECT ret.id AS return_id, ret.order_id, p.title, p.brand
     FROM returns ret JOIN orders o ON o.id=ret.order_id JOIN products p ON p.id=o.product_id
     WHERE ret.id=$1 AND ret.user_id=$2`,
        [returnId, userId]
    );
    if (!r[0]) return null;
    const {
        rows: a
    } = await query(
        "SELECT * FROM return_assessments WHERE return_id=$1 ORDER BY created_at DESC LIMIT 1",
        [returnId]
    );
    if (!a[0]) return {
        ...r[0],
        assessment: null,
        damages: [],
        images: []
    };
    const [dmg, imgs] = await Promise.all([
        query("SELECT label, severity, confidence, location FROM damage_detections WHERE assessment_id=$1", [a[0].id]),
        query("SELECT url, kind FROM product_images WHERE return_id=$1", [returnId]),
    ]);
    return {
        ...r[0],
        assessment: a[0],
        damages: dmg.rows,
        images: imgs.rows
    };
}

router.get(
    "/:returnId",
    asyncHandler(async (req, res) => {
        const ins = await loadInspection(req.params.returnId, req.user.id);
        if (!ins) return res.status(404).json({
            error: "Inspection not found"
        });
        res.json({
            inspection_id: ins.assessment ? ins.assessment.id : null,
            product: {
                title: ins.title,
                brand: ins.brand
            },
            model_used: ins.assessment ? ins.assessment.model : null,
            source: ins.assessment ? ins.assessment.source : null,
            grade: ins.assessment ? ins.assessment.grade : null,
            grade_label: ins.assessment ? ins.assessment.grade_label : null,
            confidence: ins.assessment ? Number(ins.assessment.confidence) : null,
            severity: ins.assessment ? Number(ins.assessment.severity) : null,
            reasoning: ins.assessment ? ins.assessment.reasoning : null,
            product_type: ins.assessment ? ins.assessment.product_type : null,
            inspected_at: ins.assessment ? ins.assessment.created_at : null,
            damages: ins.damages,
            images: ins.images,
        });
    })
);

router.get(
    "/:returnId/pdf",
    asyncHandler(async (req, res) => {
        const ins = await loadInspection(req.params.returnId, req.user.id);
        if (!ins || !ins.assessment) return res.status(404).json({
            error: "Inspection report not found"
        });
        const a = ins.assessment;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="inspection-${a.id.slice(0, 8)}.pdf"`);
        const doc = new PDFDocument({
            margin: 56
        });
        doc.pipe(res);

        doc.fontSize(20).fillColor("#16a34a").text("Second Life Commerce");
        doc.fontSize(12).fillColor("#444").text("AI Visual Inspection Report");
        doc.moveDown();
        doc.fillColor("#000").fontSize(11).font("Helvetica");
        const line = (k, v) => doc.font("Helvetica").fillColor("#444").text(`${k}: `, {
            continued: true
        }).font("Helvetica-Bold").fillColor("#000").text(String(v));
        line("Inspection ID", a.id);
        line("Item", `${ins.brand} ${ins.title}`);
        line("Model used", a.model || "n/a");
        line("Source", a.source);
        line("Inspected at", new Date(a.created_at).toLocaleString());
        line("Condition grade", `${a.grade} (${a.grade_label})`);
        line("Confidence", `${Math.round(Number(a.confidence) * 100)}%`);
        line("Severity", `${a.severity}/10`);
        if (a.product_type) line("Identified product", a.product_type);
        doc.moveDown();

        // Embed the first uploaded image if present on disk.
        const firstImg = ins.images.find((i) => i.kind === "image");
        if (firstImg) {
            const path = join(UPLOAD_DIR, basename(firstImg.url));
            if (existsSync(path)) {
                try {
                    doc.image(path, {
                        fit: [240, 240]
                    });
                    doc.moveDown();
                } catch {
                    /* ignore */ }
            }
        }

        doc.font("Helvetica-Bold").fillColor("#000").text("Detected damage");
        doc.font("Helvetica").fillColor("#000");
        if (ins.damages.length === 0) doc.text("No damage detected.");
        for (const d of ins.damages) {
            doc.text(`• ${d.label} @ ${d.location || "n/a"} — severity ${d.severity}/10, confidence ${Math.round(Number(d.confidence) * 100)}%`);
        }
        doc.moveDown();
        doc.font("Helvetica-Bold").text("AI reasoning");
        doc.font("Helvetica").text(a.reasoning || "n/a", {
            width: 460
        });
        doc.end();
    })
);

// Real-Time Refurbishment Instruction Generator (RRIG) - Module 25
router.get(
    "/:returnId/refurbish-instructions",
    asyncHandler(async (req, res) => {
        const ins = await loadInspection(req.params.returnId, req.user.id);
        if (!ins) return res.status(404).json({ error: "Inspection not found" });

        const skillLevel = req.query.skillLevel || "intermediate";
        const availableTools = req.query.tools ? req.query.tools.split(",") : ["microfiber cloth", "cleaning solution", "screwdrivers", "glue"];

        const instructions = await generateRefurbishInstructions(query, {
            returnId: req.params.returnId,
            userId: req.user.id,
            skillLevel,
            availableTools
        });

        res.json(instructions);
    })
);

export default router;