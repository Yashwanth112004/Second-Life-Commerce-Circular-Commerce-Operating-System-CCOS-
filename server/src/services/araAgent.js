// Autonomous Resale Agent — scans a user's owned inventory and recommends an action
// (sell_now / hold / donate) per item, with the Product Twin forecast and reasons.
import {
    productTwin
} from "./twin.js";
import {
    calculateCarbon
} from "./carbon.js";
import {
    creditsForAction
} from "./greenCredits.js";

const LIQUID = new Set(["electronics", "apparel", "home"]);

export async function scanInventory(query, user, {
    minPrice = 30,
    minAgeMonths = 3
} = {}) {
    const {
        rows
    } = await query(
        `SELECT o.id, o.purchase_price, o.age_months, o.status,
            p.title, p.brand, p.category, p.msrp, p.weight_kg, p.embedded_carbon_kg, p.monthly_depreciation, p.image_url, p.eco_score
     FROM orders o JOIN products p ON p.id=o.product_id
     WHERE o.user_id=$1 AND o.status='owned'`,
        [user.id]
    );

    const suggestions = [];
    for (const o of rows) {
        if (!LIQUID.has(o.category)) continue;
        if (Number(o.purchase_price) < minPrice) continue;

        const twin = productTwin({
            msrp: o.msrp,
            grade: "B",
            ageMonths: o.age_months,
            category: o.category,
            monthlyDepreciation: o.monthly_depreciation,
        });
        const carbon = calculateCarbon({
            embeddedCarbonKg: o.embedded_carbon_kg,
            weightKg: o.weight_kg,
            grade: "B",
            route: "zero_warehouse",
            action: "resale",
        });
        const gc = creditsForAction("resale", carbon.carbon_saved_kg);

        let action, reason;
        if (twin.current_value < 20) {
            action = "donate";
            reason = `Low resale value ($${twin.current_value}); donating maximizes impact and earns a tax receipt.`;
        } else if (o.age_months >= minAgeMonths && twin.monthly_decay_pct >= 2) {
            action = "sell_now";
            reason = `Idle ${o.age_months} months and losing ~${twin.monthly_decay_pct}%/mo — sell now to capture $${twin.current_value}.`;
        } else if (o.age_months >= minAgeMonths) {
            action = "sell_now";
            reason = `Unused for ${o.age_months} months. Worth $${twin.current_value} today; resale demand is healthy.`;
        } else {
            action = "hold";
            reason = `Value stable ($${twin.current_value}); no urgency — the agent will keep watching.`;
        }

        suggestions.push({
            order_id: o.id,
            product: {
                title: o.title,
                brand: o.brand,
                category: o.category,
                image_url: o.image_url,
                eco_score: o.eco_score
            },
            age_months: o.age_months,
            action,
            reason,
            estimated_value: twin.current_value,
            forecast: twin.forecast,
            best_resale_window: twin.best_resale_window,
            projected_carbon_kg: carbon.carbon_saved_kg,
            projected_gc: gc,
        });
    }

    // Highest-value, most-urgent first.
    const rank = {
        sell_now: 0,
        donate: 1,
        hold: 2
    };
    suggestions.sort((a, b) => (rank[a.action] - rank[b.action]) || (b.estimated_value - a.estimated_value));

    const totalValue = Math.round(suggestions.filter((s) => s.action === "sell_now").reduce((t, s) => t + s.estimated_value, 0));
    return {
        enabled: user.ara_enabled,
        scanned: rows.length,
        actionable: suggestions.length,
        total_recoverable_value: totalValue,
        headline: `The agent reviewed ${rows.length} owned items and flagged ${suggestions.filter((s) => s.action !== "hold").length} for action — about $${totalValue} recoverable now.`,
        suggestions,
    };
}