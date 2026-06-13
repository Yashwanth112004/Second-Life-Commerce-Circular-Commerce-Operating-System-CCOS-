import {
    query
} from "../db/pool.js";

/** Persist an AI inference for auditability (admin "AI logs" view). */
export async function logPrediction({
    userId,
    module,
    input,
    output,
    model,
    source,
    latencyMs
}) {
    try {
        await query(
            `INSERT INTO ai_predictions (user_id, module, input, output, model, source, latency_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [userId || null, module, JSON.stringify(input || {}), JSON.stringify(output || {}), model, source, latencyMs || 0]
        );
    } catch (e) {
        console.warn("[aiLog] failed:", e.message);
    }
}