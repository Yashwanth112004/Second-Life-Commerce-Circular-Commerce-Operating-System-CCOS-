// Autonomous Resale Agent (ARA) Inventory Scanner
import { productTwin } from "./twin.js";
import { calculateCarbon } from "./carbon.js";
import { creditsForAction } from "./greenCredits.js";
import { findBuyers } from "./nextBestOwner.js";

const LIQUID = new Set(["electronics", "apparel", "home"]);

/**
 * Scans a user's owned inventory, evaluating value curves (DCPE) and matching probability (NBOE).
 */
export async function scanInventory(query, user, {
  minPrice = 30,
  minAgeMonths = 3
} = {}) {
  const { rows } = await query(
    `SELECT o.id, o.purchase_price, o.age_months, o.status,
            p.title, p.brand, p.category, p.msrp, p.weight_kg, p.embedded_carbon_kg, p.monthly_depreciation, p.image_url, p.eco_score, p.size
     FROM orders o JOIN products p ON p.id=o.product_id
     WHERE o.user_id=$1 AND o.status='owned'`,
    [user.id]
  );

  const suggestions = [];
  for (const o of rows) {
    if (!LIQUID.has(o.category)) continue;
    if (Number(o.purchase_price) < minPrice) continue;

    // Run Dynamic Pricing & Forecast Twin
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

    // Run NBOE to get conversion probability of the best matched buyer
    let maxProbability = 0;
    let buyerMatches = [];
    try {
      const buyersResult = await findBuyers(query, {
        orderId: o.id,
        category: o.category,
        price: twin.current_value,
        sellerId: user.id,
        sellerCity: user.city,
        limit: 3
      });
      buyerMatches = buyersResult.matches;
      if (buyerMatches.length > 0) {
        maxProbability = buyerMatches[0].purchaseProbability || 0;
      }
    } catch (e) {
      console.warn("[ARA Scan] NBOE lookup failed:", e.message);
    }

    const isEol = twin.forecast.m3 < 60 && twin.monthly_decay_pct >= 1;

    let action, reason;
    if (isEol) {
      action = "sell_now";
      reason = `Your item will reach near-zero resale value in ~3 months. List now for $${twin.current_value}.`;
    } else if (twin.current_value < 20) {
      action = "donate";
      reason = `Low resale value ($${twin.current_value}); donating maximizes impact and earns a tax receipt.`;
    } else if (maxProbability < 50) {
      // Recommend donation if resale probability falls below 50% threshold
      action = "donate";
      reason = `Low resale likelihood (${maxProbability}% purchase probability); donating to a local NGO maximizes circular utility.`;
    } else if (o.age_months >= minAgeMonths && twin.monthly_decay_pct >= 2) {
      action = "sell_now";
      reason = `Idle ${o.age_months} months and losing ~${twin.monthly_decay_pct}%/mo — sell now to capture $${twin.current_value} (${maxProbability}% buy likelihood).`;
    } else if (o.age_months >= minAgeMonths) {
      action = "sell_now";
      reason = `Unused for ${o.age_months} months. Worth $${twin.current_value} today; high demand expected (${maxProbability}% buy likelihood).`;
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
        eco_score: o.eco_score,
        size: o.size,
        msrp: Number(o.msrp)
      },
      age_months: o.age_months,
      action,
      reason,
      is_eol: isEol,
      estimated_value: twin.current_value,
      forecast: twin.forecast,
      best_resale_window: twin.best_resale_window,
      projected_carbon_kg: carbon.carbon_saved_kg,
      projected_gc: gc,
      resale_probability: maxProbability,
      buyers: buyerMatches
    });
  }

  // Highest-value, most-urgent first
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