import {
    chatJSON,
    AIUnavailable
} from "./openrouter.js";

function deterministic({
    name,
    carbonKg,
    greenCredits,
    topCategory
}) {
    return {
        headline: `${name}, you've prevented ${carbonKg.toFixed(1)} kg of CO\u2082 so far.`,
        insights: [
            `Your strongest circular category is ${topCategory || "electronics"} — keep reselling there.`,
            `You hold ${greenCredits} Green Credits (worth $${(greenCredits * 0.1).toFixed(2)}). Redeem or donate them.`,
        ],
        suggestions: [
            "Choose 'repair' over 'replace' on your next eligible item to earn up to 100 GC.",
            "List one idle item this week — the Resale Agent can do it for you.",
            "Buy your next accessory Certified Preloved to cut ~10 kg CO\u2082.",
        ],
    };
}

export async function coach({
    name,
    carbonKg,
    greenCredits,
    topCategory,
    recentActions
}) {
    const system = "You are a friendly, concrete sustainability coach for a circular-commerce app. Respond ONLY with JSON.";
    const user = `User ${name} has saved ${carbonKg} kg CO2, holds ${greenCredits} Green Credits, most active in ${topCategory || "unknown"}.
Recent actions: ${(recentActions || []).join(", ") || "none"}.
Return JSON: { headline (1 sentence), insights (array of 2), suggestions (array of 3 specific next actions) }.`;
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
                headline: data.headline || "",
                insights: Array.isArray(data.insights) ? data.insights : [],
                suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
            },
            model,
            source,
            latencyMs,
        };
    } catch (e) {
        if (!(e instanceof AIUnavailable)) console.warn("[coach] AI error:", e.message);
        return {
            result: deterministic({
                name,
                carbonKg,
                greenCredits,
                topCategory
            }),
            model: "deterministic",
            source: "fallback",
            latencyMs: 0
        };
    }
}