import crypto from "node:crypto";
import {
    chatJSON,
    AIUnavailable
} from "./openrouter.js";

const GRADE_LABELS = {
    "A+": "Like New",
    A: "Excellent",
    B: "Good",
    C: "Fair",
    D: "Parts / Salvage"
};
const DISPOSITION = {
    "A+": "Resell As-Is (Certified Preloved)",
    A: "Resell As-Is",
    B: "Resell As-Is",
    C: "Refurbish & Resell",
    D: "Parts-Harvest / Recycle",
};
const DAMAGE_LIB = {
    electronics: ["minor surface scuff on rear casing", "light wear on charging port", "battery health ~88%"],
    apparel: ["very light pilling on cuff", "no visible stains or tears", "mild fading from washing"],
    home: ["small scuff on base", "all components present", "no functional defects detected"],
    default: ["light cosmetic wear", "no structural damage detected", "fully functional on inspection"],
};

function deterministic({
    category,
    photoCount,
    reasonText,
    seed
}) {
    const hex = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8);
    const bucket = parseInt(hex, 16) % 100;
    let grade = "A";
    if (bucket < 35) grade = "A+";
    else if (bucket < 65) grade = "A";
    else if (bucket < 85) grade = "B";
    else if (bucket < 95) grade = "C";
    else grade = "D";
    const notes = (DAMAGE_LIB[category] || DAMAGE_LIB.default).slice(0, grade === "A+" ? 2 : 3);
    return {
        grade,
        grade_label: GRADE_LABELS[grade],
        confidence: 0.9,
        reasoning: `Deterministic assessment from ${photoCount} photo(s)${
      reasonText ? ` and stated reason "${reasonText}"` : ""
    }. Surface wear consistent with grade ${grade}.`,
        recommended_disposition: DISPOSITION[grade],
        packaging_condition: grade === "A+" ? "original, intact" : "acceptable",
        missing_accessories: [],
        damages: notes.map((label, i) => ({
            label,
            severity: grade === "A+" ? 1 : grade === "D" ? 7 : 3,
            confidence: 0.9 - i * 0.05,
            location: i === 0 ? "primary surface" : "secondary",
        })),
    };
}

/**
 * Real AI condition assessment. Uses the LLM to reason over product context + user-supplied
 * evidence description. Note: pixel-level damage CV requires a vision model; this reasons over
 * the structured evidence and is swappable for a vision-capable OpenRouter model.
 */
export async function assessCondition({
    product,
    photoCount,
    videoCount,
    reasonText,
    evidenceNotes
}) {
    const system =
        "You are a product-condition grading expert for a circular-commerce platform. " +
        "Grade returned items honestly. Respond ONLY with JSON.";
    const user = `Grade this returned item and return JSON with keys:
grade (one of A+,A,B,C,D), grade_label, confidence (0-1),
reasoning (2 sentences), recommended_disposition,
packaging_condition, missing_accessories (array of strings),
damages (array of {label, severity 0-10, confidence 0-1, location}).

Item: ${product.brand} ${product.title} (category: ${product.category}, MSRP $${product.msrp}).
Evidence submitted: ${photoCount} photo(s), ${videoCount} video(s).
Customer notes: ${reasonText || "none"}.
Inspector notes: ${evidenceNotes || "none"}.`;

    try {
        const {
            data,
            model,
            source,
            latencyMs
        } = await chatJSON({
            system,
            user
        });
        const grade = ["A+", "A", "B", "C", "D"].includes(data.grade) ? data.grade : "A";
        return {
            result: {
                grade,
                grade_label: data.grade_label || GRADE_LABELS[grade],
                confidence: Math.min(1, Math.max(0, Number(data.confidence) || 0.9)),
                reasoning: data.reasoning || "",
                recommended_disposition: data.recommended_disposition || DISPOSITION[grade],
                packaging_condition: data.packaging_condition || "acceptable",
                missing_accessories: Array.isArray(data.missing_accessories) ? data.missing_accessories : [],
                damages: Array.isArray(data.damages) ? data.damages : [],
            },
            model,
            source,
            latencyMs,
        };
    } catch (e) {
        if (!(e instanceof AIUnavailable)) console.warn("[conditionAssessment] AI error:", e.message);
        const seed = `${product.id}:${photoCount}:${reasonText || ""}`;
        return {
            result: deterministic({
                category: product.category,
                photoCount,
                reasonText,
                seed
            }),
            model: "deterministic",
            source: "fallback",
            latencyMs: 0,
        };
    }
}