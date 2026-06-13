import {
    config
} from "../../config.js";

/**
 * OpenRouter client.
 *  - chatJSON()   -> TEXT models (Nemotron) for listings / root-cause / coach / reports
 *  - visionJSON() -> VISION models (Qwen-VL) for damage detection / condition grading,
 *                    sending the actual image bytes as base64 data URIs.
 * Both try a primary model then a fallback, and report which model produced the result.
 */
export class AIUnavailable extends Error {}

function extractJson(text) {
    if (!text) throw new Error("empty completion");
    const cleaned = text.replace(/```json/gi, "```").replace(/```/g, "").trim();
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    return JSON.parse(match ? match[0] : cleaned);
}

async function callModel(model, messages, maxTokens) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
        const res = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
            method: "POST",
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${config.openrouter.apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://second-life-commerce.local",
                "X-Title": "Second Life Commerce",
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.2,
                max_tokens: maxTokens || 900,
                response_format: {
                    type: "json_object"
                },
            }),
        });
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`OpenRouter ${res.status} (${model}): ${body.slice(0, 300)}`);
        }
        const json = await res.json();
        const choice = json.choices && json.choices[0] && json.choices[0].message;
        return extractJson(choice ? choice.content : "");
    } finally {
        clearTimeout(timeout);
    }
}

/** Text-only JSON completion (Nemotron + fallback). */
export async function chatJSON({
    system,
    user
}) {
    if (!config.openrouter.enabled) throw new AIUnavailable("OPENROUTER_API_KEY not set");
    const messages = [{
            role: "system",
            content: system
        },
        {
            role: "user",
            content: user
        },
    ];
    const started = Date.now();
    let lastErr;
    for (const model of [config.openrouter.textModel, config.openrouter.textFallbackModel]) {
        try {
            const data = await callModel(model, messages, 900);
            return {
                data,
                model,
                source: "ai",
                latencyMs: Date.now() - started
            };
        } catch (e) {
            lastErr = e;
            console.warn("[openrouter:text] model failed:", e.message);
        }
    }
    throw new AIUnavailable(`All text models failed: ${lastErr ? lastErr.message : "?"}`);
}

/**
 * Multimodal JSON completion. `images` is an array of base64 data URIs
 * (e.g. "data:image/jpeg;base64,...."). Tries the vision model then a vision fallback,
 * and returns which model performed the inspection.
 */
export async function visionJSON({
    system,
    userText,
    images
}) {
    if (!config.openrouter.enabled) throw new AIUnavailable("OPENROUTER_API_KEY not set");
    if (!images || images.length === 0) throw new Error("no images supplied to vision model");

    const content = [{
        type: "text",
        text: userText
    }];
    for (const uri of images) content.push({
        type: "image_url",
        image_url: {
            url: uri
        }
    });
    const messages = [{
            role: "system",
            content: system
        },
        {
            role: "user",
            content
        },
    ];

    const started = Date.now();
    let lastErr;
    const models = [config.openrouter.visionModel, config.openrouter.visionFallbackModel];
    for (let i = 0; i < models.length; i++) {
        const model = models[i];
        try {
            const data = await callModel(model, messages, 1200);
            return {
                data,
                model,
                source: i === 0 ? "vision" : "vision_fallback",
                latencyMs: Date.now() - started,
            };
        } catch (e) {
            lastErr = e;
            console.warn(`[openrouter:vision] model ${model} failed:`, e.message);
        }
    }
    throw new AIUnavailable(`All vision models failed: ${lastErr ? lastErr.message : "?"}`);
}