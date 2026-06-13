import {
    readFile
} from "node:fs/promises";
import {
    basename,
    extname,
    join
} from "node:path";
import {
    visionJSON,
    AIUnavailable
} from "./openrouter.js";
import {
    UPLOAD_DIR
} from "../../middleware/upload.js";

const VALID_GRADES = ["A+", "A", "B", "C", "D", "F"];
const GRADE_LABEL = {
    "A+": "Like New",
    A: "Minor Wear",
    B: "Visible Wear",
    C: "Moderate Damage",
    D: "Severe Damage",
    F: "Parts Only",
};
const VALID_DISPOSITIONS = ["refund", "resell", "repair", "donate", "parts", "recycle"];
const MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif"
};

const SYSTEM =
    "You are an expert product-inspection vision model for a circular-commerce returns platform. " +
    "You examine the ACTUAL uploaded photos of a returned item and report exactly what you see. " +
    "Be decisive about visible damage: cracked/shattered screens, water damage, dents, missing parts. " +
    "Respond with JSON only, no prose.";

function buildPrompt(product) {
    return `Analyze the uploaded return product image(s). The seller's catalog says this is likely:
"${product.brand} ${product.title}" (category: ${product.category}). Verify from the image.

Identify: product type; visible damage (cracks, scratches, water damage, dirt/contamination);
missing parts/accessories; packaging condition.

Grading scale (be strict, grade from what is VISIBLE):
  A+ = Like New, A = Minor Wear, B = Visible Wear, C = Moderate Damage,
  D = Severe Damage (e.g. cracked screen, missing battery), F = Parts Only (e.g. shattered screen, water-damaged electronics).

Recommend ONE disposition: refund | resell | repair | donate | parts | recycle.

Return JSON ONLY with this exact schema:
{
  "productType": "",
  "conditionGrade": "A+|A|B|C|D|F",
  "confidence": 0.0,
  "severity": 0,
  "damages": [ { "label": "", "location": "", "severity": 0, "confidence": 0.0 } ],
  "missingAccessories": [],
  "packagingCondition": "",
  "recommendedDisposition": "",
  "reasoning": ""
}`;
}

function normalizeGrade(g) {
    if (!g) return null;
    const up = String(g).toUpperCase().trim();
    if (VALID_GRADES.includes(up)) return up;
    for (const v of VALID_GRADES)
        if (up.includes(v)) return v; // "GRADE D", "D/F"
    return null;
}

function normalizeConfidence(c) {
    let n = Number(c);
    if (!isFinite(n)) return 0;
    if (n > 1) n = n / 100;
    return Math.max(0, Math.min(1, n));
}

function normalizeDisposition(d, grade) {
    const low = String(d || "").toLowerCase();
    for (const v of VALID_DISPOSITIONS)
        if (low.includes(v)) return v;
    if (grade === "F") return "parts";
    if (grade === "D") return "repair";
    return "resell";
}

async function toDataUri(image) {
    const file = join(UPLOAD_DIR, basename(image.url));
    const buf = await readFile(file);
    const mime = MIME[extname(file).toLowerCase()] || "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
}

// A severe grade (C/D/F) with no detected damage AND no reasoning is internally
// inconsistent — a small vision model occasionally emits this. Reject as inconclusive.
function isUnsupportedSevereGrade(grade, damages, reasoning) {
    const severe = grade === "C" || grade === "D" || grade === "F";
    const hasEvidence = (damages && damages.length > 0) || (reasoning && reasoning.trim().length > 12);
    return severe && !hasEvidence;
}

/**
 * Runs vision inspection on the uploaded images.
 * Returns { status, result, model, source }.
 *   status: "ok" | "needs_more_photos" | "unavailable"
 * Never fabricates damage: if vision can't run, status reflects that honestly.
 */
export async function inspectImages({
    images,
    product
}) {
    const imageRows = (images || []).filter((i) => i.kind === "image");

    if (imageRows.length === 0) {
        return {
            status: "needs_more_photos",
            model: null,
            source: "none",
            result: {
                grade: null,
                confidence: 0,
                reasoning: "No photos were provided. A visual inspection requires at least one image.",
                required_views: ["Front view", "Back view", "Damage close-up", "Packaging"],
            },
        };
    }

    let dataUris;
    try {
        dataUris = await Promise.all(imageRows.slice(0, 5).map(toDataUri));
    } catch (e) {
        console.error("[vision] failed reading image files:", e.message);
        return unavailable("Could not read the uploaded image files for inspection.");
    }

    try {
        const {
            data,
            model,
            source,
            latencyMs
        } = await visionJSON({
            system: SYSTEM,
            userText: buildPrompt(product),
            images: dataUris,
        });

        const grade = normalizeGrade(data.conditionGrade);
        const confidence = normalizeConfidence(data.confidence);
        const damages = Array.isArray(data.damages) ?
            data.damages.map((d) => ({
                label: String(d.label || "unspecified"),
                location: String(d.location || ""),
                severity: Math.max(0, Math.min(10, Number(d.severity) || 0)),
                confidence: normalizeConfidence(d.confidence),
            })) : [];

        if (!grade || confidence < 0.5 || isUnsupportedSevereGrade(grade, damages, data.reasoning)) {
            return {
                status: "needs_more_photos",
                model,
                source,
                latencyMs,
                result: {
                    grade,
                    confidence,
                    product_type: data.productType || "",
                    damages,
                    reasoning: (data.reasoning ||
                            "Inspection inconclusive — the model could not justify a grade.") +
                        " — please add clearer, well-lit photos (front, back, close-up of any damage).",
                    required_views: ["Front view", "Back view", "Damage close-up", "Packaging"],
                },
            };
        }

        return {
            status: "ok",
            model,
            source,
            latencyMs,
            result: {
                grade,
                grade_label: GRADE_LABEL[grade],
                confidence,
                severity: Math.max(0, Math.min(10, Number(data.severity) || 0)),
                product_type: data.productType || "",
                damages,
                missing_accessories: Array.isArray(data.missingAccessories) ? data.missingAccessories : [],
                packaging_condition: data.packagingCondition || "",
                recommended_disposition: normalizeDisposition(data.recommendedDisposition, grade),
                reasoning: data.reasoning || "",
            },
        };
    } catch (e) {
        if (e instanceof AIUnavailable) return unavailable(e.message);
        console.error("[vision] inspection error:", e.message);
        return unavailable("Vision inspection failed: " + e.message);
    }
}

function unavailable(message) {
    return {
        status: "unavailable",
        model: null,
        source: "unavailable",
        result: {
            grade: null,
            confidence: 0,
            damages: [],
            reasoning: "Vision AI is unavailable, so no automated condition grade was produced. " +
                "Set OPENROUTER_API_KEY to enable image inspection. (" + message + ")",
            required_views: [],
        },
    };
}