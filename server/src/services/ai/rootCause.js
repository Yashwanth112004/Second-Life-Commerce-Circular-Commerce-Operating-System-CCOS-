import {
    chatJSON,
    AIUnavailable
} from "./openrouter.js";

const TAXONOMY = ["size_fit", "expectation_mismatch", "quality_defect", "lifestyle_change", "gift_return", "price_regret", "damaged_in_transit", "changed_mind"];

function deterministic({
    reasonCode,
    reasonText
}) {
    const text = (reasonText || "").toLowerCase();
    let trueReason = reasonCode || "changed_mind";
    if (/small|big|fit|size|tight|loose/.test(text)) trueReason = "size_fit";
    else if (/broke|defect|stopped|faulty|not work/.test(text)) trueReason = "quality_defect";
    else if (/expected|looked|photo|description|different/.test(text)) trueReason = "expectation_mismatch";
    else if (/gift/.test(text)) trueReason = "gift_return";
    return {
        true_reason: trueReason,
        confidence: 0.7,
        seller_insights: [
            "Add more detailed photos and dimensions to the listing.",
            "Clarify sizing/spec expectations to reduce mismatch returns.",
        ],
    };
}

export async function analyzeRootCause({
    product,
    reasonCode,
    reasonText,
    comments
}) {
    const system = "You analyze e-commerce return reasons to find the TRUE root cause and give sellers actionable insight. Respond ONLY with JSON.";
    const user = `Return for ${product.brand} ${product.title} (${product.category}).
Stated reason code: ${reasonCode}. Free text: "${reasonText || ""}". Extra comments: "${comments || ""}".
Return JSON: { true_reason (one of ${TAXONOMY.join(", ")}), confidence (0-1), seller_insights (array of 2-3 specific recommendations) }.`;
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
        return {
            result: {
                true_reason: TAXONOMY.includes(data.true_reason) ? data.true_reason : (reasonCode || "changed_mind"),
                confidence: Math.min(1, Math.max(0, Number(data.confidence) || 0.7)),
                seller_insights: Array.isArray(data.seller_insights) ? data.seller_insights : [],
            },
            model,
            source,
            latencyMs,
        };
    } catch (e) {
        if (!(e instanceof AIUnavailable)) console.warn("[rootCause] AI error:", e.message);
        return {
            result: deterministic({
                reasonCode,
                reasonText
            }),
            model: "deterministic",
            source: "fallback",
            latencyMs: 0
        };
    }
}