// AI Circular Concierge — the proactive intelligence layer.
// Synthesizes the ARA inventory scan, Product Twin forecasts, CES, carbon, and Green
// Credits into ranked, explainable recommendations the moment a user logs in.
import {
    scanInventory
} from "./araAgent.js";
import {
    computeCES
} from "./ces.js";

const ACTION_META = {
    sell_now: {
        verb: "Sell now",
        icon: "💰",
        score_delta: 6
    },
    donate: {
        verb: "Donate",
        icon: "🎁",
        score_delta: 5
    },
    repair: {
        verb: "Repair then sell",
        icon: "🔧",
        score_delta: 8
    },
    hold: {
        verb: "Hold",
        icon: "⏸",
        score_delta: 0
    },
};

function confidenceFor(s) {
    if (s.action === "sell_now") {
        if (s.age_months >= 6 && s.estimated_value >= 80) return 0.93;
        if (s.age_months >= 6) return 0.86;
        return 0.78;
    }
    if (s.action === "donate") return 0.82;
    if (s.action === "repair") return 0.8;
    return 0.7; // hold
}

function reasonsFor(s) {
    const out = [];
    if (s.action === "sell_now") {
        out.push({
            factor: "Idle time",
            detail: `Unused for ${s.age_months} months`,
            weight: "high"
        });
        out.push({
            factor: "Twin forecast",
            detail: `Worth $${s.estimated_value} now; best window: ${s.best_resale_window}`,
            weight: "high"
        });
        if (s.forecast && s.forecast.m6 < s.estimated_value)
            out.push({
                factor: "Depreciation",
                detail: `Drops to ~$${s.forecast.m6} in 6 months`,
                weight: "medium"
            });
    } else if (s.action === "donate") {
        out.push({
            factor: "Low resale value",
            detail: `Only ~$${s.estimated_value} on resale`,
            weight: "high"
        });
        out.push({
            factor: "NGO demand",
            detail: "An active NGO request matches this category",
            weight: "medium"
        });
        out.push({
            factor: "Tax + impact",
            detail: "Instant tax receipt and community impact",
            weight: "medium"
        });
    } else {
        out.push({
            factor: "Stable value",
            detail: `Holding at ~$${s.estimated_value}; low decay`,
            weight: "medium"
        });
        out.push({
            factor: "Demand watch",
            detail: "Agent will alert if demand rises",
            weight: "low"
        });
    }
    return out;
}

export async function buildRecommendations(query, user) {
    const plan = await scanInventory(query, user);

    const recommendations = plan.suggestions.map((s) => {
        const ces = computeCES({
            category: s.product.category,
            ecoScore: s.product.eco_score || 60,
            grade: "B",
            ageMonths: s.age_months,
        });
        const meta = ACTION_META[s.action] || ACTION_META.hold;
        const confidence = confidenceFor(s);
        const valueRecovery = s.action === "sell_now" || s.action === "repair" ? s.estimated_value : (s.action === "donate" ? Math.round(s.estimated_value * 0.6) : 0);
        return {
            order_id: s.order_id,
            product: s.product,
            action: s.action,
            action_verb: meta.verb,
            icon: meta.icon,
            headline: `${meta.verb}: ${s.product.title}`,
            summary: s.reason,
            confidence,
            reasons: reasonsFor(s),
            impact: {
                value_recovery_usd: valueRecovery,
                carbon_opportunity_kg: s.projected_carbon_kg,
                green_credits_opportunity: s.projected_gc,
                circular_score_delta: meta.score_delta,
                ces_score: ces.score,
            },
            twin: {
                current_value: s.estimated_value,
                forecast: s.forecast,
                best_resale_window: s.best_resale_window
            },
        };
    });

    // Rank: actionable first, by confidence then value.
    const actionRank = {
        sell_now: 0,
        repair: 1,
        donate: 2,
        hold: 3
    };
    recommendations.sort((a, b) => (actionRank[a.action] - actionRank[b.action]) || (b.confidence - a.confidence) || (b.impact.value_recovery_usd - a.impact.value_recovery_usd));

    const actionable = recommendations.filter((r) => r.action !== "hold");
    const summary = {
        total_value_recovery_usd: actionable.reduce((t, r) => t + r.impact.value_recovery_usd, 0),
        total_carbon_opportunity_kg: Math.round(actionable.reduce((t, r) => t + r.impact.carbon_opportunity_kg, 0) * 10) / 10,
        total_gc_opportunity: actionable.reduce((t, r) => t + r.impact.green_credits_opportunity, 0),
        total_circular_score_opportunity: Math.min(actionable.reduce((t, r) => t + r.impact.circular_score_delta, 0), 40),
        scanned: plan.scanned,
        actionable: actionable.length,
    };

    const top = recommendations[0];
    const headline = actionable.length > 0 ?
        `I analyzed your ${plan.scanned} products. ${actionable.length} need attention — about $${summary.total_value_recovery_usd} recoverable and ${summary.total_carbon_opportunity_kg} kg CO₂ to save.` :
        `I analyzed your ${plan.scanned} products. Everything looks optimal right now — I'll keep watching the market.`;

    return {
        enabled: user.ara_enabled,
        headline,
        top_action: top ? {
            headline: top.headline,
            action: top.action,
            order_id: top.order_id
        } : null,
        summary,
        recommendations,
    };
}