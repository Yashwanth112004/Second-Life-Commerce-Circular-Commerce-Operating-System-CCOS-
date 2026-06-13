import {
    chatJSON,
    AIUnavailable
} from "./openrouter.js";

const GRADE_BLURB = {
    "A+": "barely used and indistinguishable from new",
    A: "in excellent condition with only the faintest signs of use",
    B: "in good, fully-functional condition with light cosmetic wear",
    C: "in fair condition — a great-value pick that works perfectly",
    D: "sold for parts/repair",
};

function deterministic({
    product,
    grade,
    gradeLabel,
    damageNotes,
    price,
    ageMonths
}) {
    const blurb = GRADE_BLURB[grade] || "in good condition";
    const age = ageMonths <= 1 ? "practically new" : `gently used for ~${ageMonths} months`;
    return {
        title: `${product.brand ? product.brand + " " : ""}${product.title} — Certified Preloved (${gradeLabel})`,
        description: `This ${product.title} is ${blurb}. ${age[0].toUpperCase() + age.slice(1)}, AI-inspected and graded ${grade}. Ships with our Second Life Guarantee: full refund if it doesn't match the AI condition report. Yours for $${price}.`,
        features: [
            `AI condition grade ${grade} (${gradeLabel})`,
            "Certified Preloved — Second Life Guarantee",
            "Verified carbon savings vs. buying new",
        ],
        keywords: [product.brand, product.category, "certified preloved", "refurbished", "sustainable"].filter(Boolean).map((k) => String(k).toLowerCase()),
        condition_notes: `Condition disclosure: ${(damageNotes || []).join("; ") || "light wear"}`,
    };
}

export async function generateListing({
    product,
    grade,
    gradeLabel,
    damageNotes,
    price,
    ageMonths
}) {
    const system = "You are a marketplace copywriter for circular commerce. Honest, concise, SEO-aware. Respond ONLY with JSON.";
    const user = `Write a resale listing as JSON with keys: title, description (3 sentences), features (array of 3), keywords (array of 6), condition_notes.
Item: ${product.brand} ${product.title}, category ${product.category}, AI grade ${grade} (${gradeLabel}), age ${ageMonths} months, price $${price}.
Inspection notes: ${(damageNotes || []).join("; ") || "light wear"}.`;
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
                title: data.title || deterministic({
                    product,
                    grade,
                    gradeLabel,
                    damageNotes,
                    price,
                    ageMonths
                }).title,
                description: data.description || "",
                features: Array.isArray(data.features) ? data.features : [],
                keywords: Array.isArray(data.keywords) ? data.keywords : [],
                condition_notes: data.condition_notes || "",
            },
            model,
            source,
            latencyMs,
        };
    } catch (e) {
        if (!(e instanceof AIUnavailable)) console.warn("[listing] AI error:", e.message);
        return {
            result: deterministic({
                product,
                grade,
                gradeLabel,
                damageNotes,
                price,
                ageMonths
            }),
            model: "deterministic",
            source: "fallback",
            latencyMs: 0
        };
    }
}