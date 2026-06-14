import { chatJSON } from "./ai/openrouter.js";
import { logPrediction } from "./aiLog.js";

const GRADE_RETENTION = {
  "A+": 0.82,
  "A": 0.72,
  "B": 0.58,
  "C": 0.40,
  "D": 0.20,
  "F": 0.05
};

const DEMAND_MULTIPLIER = {
  electronics: 1.08,
  apparel: 1.02,
  home: 0.98
};

/**
 * Recommend resale price using the Dynamic Circular Pricing Engine (DCPE).
 * Supports standard parameters as well as new circular metrics.
 */
export function recommendPrice({
  msrp,
  grade = "B",
  ageMonths = 6,
  category = "electronics",
  monthlyDepreciation = 0.015,
  demandScore = null,
  brandValue = 85,
  region = "Bengaluru",
  marketTrends = "stable"
}) {
  const itemMsrp = Number(msrp || 100);
  const retention = GRADE_RETENTION[grade] || 0.55;
  const baseDemand = DEMAND_MULTIPLIER[category] || 1.0;
  const demand = demandScore !== null ? Number(demandScore) / 60 : baseDemand;
  const ageFactor = Math.max(1 - Number(monthlyDepreciation) * Number(ageMonths), 0.25);
  const brandFactor = 0.9 + (Number(brandValue) / 1000); // e.g. brandValue=85 -> 0.985
  const trendFactor = marketTrends === "up" ? 1.06 : marketTrends === "down" ? 0.92 : 1.0;

  // Calculate circular baseline price
  const base = itemMsrp * retention * ageFactor * demand * brandFactor * trendFactor;
  const recommended = Math.round(base);
  const floor = Math.round(base * 0.88);
  const ceiling = Math.round(base * 1.08);

  const finalDemandScore = Math.round(Math.min(100, demand * 60 + retention * 40));
  const confidence = Math.max(50, Math.min(99, 95 - Number(ageMonths) - (["D", "F"].includes(grade) ? 12 : 0)));
  const estDays = Math.max(2, Math.round((1.2 - baseDemand) * 10) + (["C", "D"].includes(grade) ? 4 : 1));

  // Markdown Schedule
  const markdownSchedule = [
    { day: 0, price: recommended, percentage: 0 },
    { day: 7, price: Math.round(recommended * 0.95), percentage: 5 },
    { day: 14, price: Math.round(recommended * 0.90), percentage: 10 },
    { day: 21, price: floor, percentage: 15 }
  ];

  const pctRetention = Math.round(retention * 100);
  const pctDepreciation = Math.round((1 - ageFactor) * 100);
  const rationale = `${pctRetention}% MSRP retention for condition ${grade}, ${pctDepreciation}% age depreciation over ${ageMonths}mo. Category demand index: ${baseDemand.toFixed(2)}. Adjusted for brand value (${brandValue}/100) and regional market trends (${marketTrends}).`;

  return {
    recommended_price: recommended,
    price_floor: floor,
    price_ceiling: ceiling,
    demand_score: finalDemandScore,
    price_confidence: confidence,
    expected_sale_time_days: estDays,
    markdown_schedule: markdownSchedule,
    rationale
  };
}

/**
 * AI-backed Wrapper for DCPE.
 */
export const PricingEngineService = {
  async recommend(db, {
    productId,
    msrp,
    grade,
    ageMonths,
    category,
    brandValue = 85,
    region = "Bengaluru",
    marketTrends = "stable"
  }) {
    const started = Date.now();
    let resultData;
    let apiSource = "fallback";
    let modelUsed = "deterministic_formula";

    // Call openrouter chat JSON if enabled
    try {
      const system = `You are the Dynamic Circular Pricing Engine (DCPE) for a circular commerce platform.
Determine the optimal resale price, price range, expected sale time (days), price confidence (0-100), markdown schedule, and pricing explanation.
Respond ONLY with a JSON object matching this exact structure:
{
  "recommended_price": 14500,
  "price_floor": 13800,
  "price_ceiling": 15200,
  "expected_sale_time_days": 4,
  "price_confidence": 92,
  "markdown_schedule": [
    { "day": 0, "price": 14500, "percentage": 0 },
    { "day": 7, "price": 13775, "percentage": 5 },
    { "day": 14, "price": 13050, "percentage": 10 },
    { "day": 21, "price": 12325, "percentage": 15 }
  ],
  "rationale": "92% confidence resale price for grade A+ electronics with 4-day sale velocity."
}`;

      const userPrompt = `Calculate optimal resale price for:
Product MSRP: ${msrp}
Grade: ${grade}
Age: ${ageMonths} months
Category: ${category}
Brand Value: ${brandValue}/100
Region: ${region}
Market Trend: ${marketTrends}`;

      const aiRes = await chatJSON({ system, user: userPrompt });
      resultData = aiRes.data;
      apiSource = aiRes.source;
      modelUsed = aiRes.model;
    } catch (e) {
      // Fallback to formula
      resultData = recommendPrice({
        msrp,
        grade,
        ageMonths,
        category,
        monthlyDepreciation: 0.015,
        brandValue,
        region,
        marketTrends
      });
    }

    // Log the prediction
    await logPrediction({
      userId: null,
      module: "pricing",
      input: { productId, msrp, grade, ageMonths, category, brandValue, region, marketTrends },
      output: resultData,
      model: modelUsed,
      source: apiSource,
      latencyMs: Date.now() - started
    });

    return resultData;
  }
};