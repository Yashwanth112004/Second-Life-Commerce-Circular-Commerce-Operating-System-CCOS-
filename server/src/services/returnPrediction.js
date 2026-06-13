import { chatJSON } from "./ai/openrouter.js";
import { logPrediction } from "./aiLog.js";

/**
 * Predict return likelihood before purchase.
 * 
 * @param {Function} db Query function
 * @param {Object} params Inputs (userId, productId, listingId, category, price, brand, listingQualityScore, behavior, context)
 * @returns {Promise<Object>} RIP output
 */
export async function predictReturn(db, {
  userId,
  productId,
  listingId,
  category = "electronics",
  price = 0,
  brand = "Generic",
  listingQualityScore = 85,
  behavior = {},
  context = {}
}) {
  const started = Date.now();

  // 1. Gather Customer Profile from DB if userId is provided
  let purchasesCount = 0;
  let returnsCount = 0;
  let avgOrderValue = 0;
  let categoriesHistory = [];

  if (userId) {
    try {
      const { rows: oRows } = await db(
        `SELECT COUNT(*)::int AS total, COALESCE(AVG(purchase_price),0)::numeric(12,2) AS avg_val
         FROM orders WHERE user_id = $1`,
        [userId]
      );
      if (oRows[0]) {
        purchasesCount = oRows[0].total;
        avgOrderValue = Number(oRows[0].avg_val);
      }

      const { rows: rRows } = await db(
        `SELECT COUNT(*)::int AS total
         FROM returns WHERE user_id = $1 AND chosen_path IN ('refund', 'resell', 'exchange')`,
        [userId]
      );
      if (rRows[0]) {
        returnsCount = rRows[0].total;
      }

      const { rows: catRows } = await db(
        `SELECT DISTINCT p.category
         FROM orders o JOIN products p ON p.id = o.product_id
         WHERE o.user_id = $1`,
        [userId]
      );
      categoriesHistory = catRows.map(r => r.category);
    } catch (e) {
      console.warn("[RIP] Failed to fetch user profile history:", e.message);
    }
  }

  // Set default behavioral/contextual values if missing
  const timeOnPage = Number(behavior.timeOnPage || 45);
  const imagesViewed = Number(behavior.imagesViewed || 1);
  const questionsAsked = Number(behavior.questionsAsked || 0);
  const productComparisons = Number(behavior.productComparisons || 0);
  const sessionDuration = Number(behavior.sessionDuration || 120);

  const season = context.season || "Summer";
  const day = context.day || "Saturday";
  const deviceType = context.deviceType || "desktop";

  let resultData;
  let apiSource = "fallback";
  let modelUsed = "deterministic_formula";

  // 2. Query AI if OpenRouter is enabled
  try {
    const system = `You are the Return Intent Predictor (RIP) for a circular commerce platform.
Predict the return probability (0-100), risk level (LOW, MEDIUM, HIGH), top factors, and prevention recommendations.
Respond ONLY with a JSON object matching this exact structure:
{
  "returnProbability": 82,
  "riskLevel": "HIGH",
  "topFactors": ["Size mismatch risk", "Frequent apparel returns", "Low listing confidence"],
  "recommendations": ["Use Smart Size Advisor", "Watch product video", "Review measurements"]
}`;

    const userPrompt = `Evaluate Return Intent risk with these details:
Customer Profile:
- Purchases: ${purchasesCount}
- Returns: ${returnsCount}
- Average Order Value: $${avgOrderValue}
- Category History: [${categoriesHistory.join(", ")}]

Product:
- Category: ${category}
- Brand: ${brand}
- Price: $${price}
- Listing Quality Score: ${listingQualityScore}/100

Behavior:
- Time on page: ${timeOnPage}s
- Images viewed: ${imagesViewed}
- Questions asked: ${questionsAsked}
- Product comparisons: ${productComparisons}
- Session duration: ${sessionDuration}s

Context:
- Season: ${season}
- Day: ${day}
- Device: ${deviceType}`;

    const aiRes = await chatJSON({ system, user: userPrompt });
    resultData = aiRes.data;
    apiSource = aiRes.source;
    modelUsed = aiRes.model;
  } catch (e) {
    // 3. Fallback: Deterministic Business Rule Calculations
    let probability = 15; // Base probability

    // Factor 1: Sizing Sizing apparel sizing risk
    if (category.toLowerCase() === "apparel") {
      probability += 15;
    } else if (category.toLowerCase() === "electronics") {
      probability += 5;
    }

    // Factor 2: User return history rate
    if (purchasesCount > 0) {
      const returnRate = returnsCount / purchasesCount;
      probability += Math.round(returnRate * 45);
    }

    // Factor 3: Listing quality
    if (listingQualityScore < 85) {
      probability += Math.round((85 - listingQualityScore) * 1.2);
    }

    // Factor 4: Behavior indicators
    if (timeOnPage < 30 && imagesViewed < 2) {
      probability += 15; // Quick impulse buy
    }
    if (questionsAsked === 0 && category.toLowerCase() === "apparel") {
      probability += 10; // Sizing guess
    }
    if (productComparisons > 3) {
      probability += 5; // Indecisiveness
    }

    // Factor 5: Context indicators
    if (["Winter", "Holiday"].includes(season)) {
      probability += 8; // Gift returns
    }

    // Clamp
    probability = Math.max(5, Math.min(95, probability));

    let riskLevel = "LOW";
    if (probability >= 65) riskLevel = "HIGH";
    else if (probability >= 30) riskLevel = "MEDIUM";

    const topFactors = [];
    const recommendations = [];

    // Determine top factors and recommendations
    if (category.toLowerCase() === "apparel" && questionsAsked === 0) {
      topFactors.push("Size mismatch risk");
      recommendations.push("Use Smart Size Advisor");
      recommendations.push("Review product measurements table");
    }
    if (purchasesCount > 0 && (returnsCount / purchasesCount) > 0.25) {
      topFactors.push("Frequent returns history");
      recommendations.push("Double check item details");
    }
    if (timeOnPage < 30 || imagesViewed < 2) {
      topFactors.push("Low listing confidence");
      recommendations.push("Watch product video");
    }
    if (listingQualityScore < 80) {
      topFactors.push("Incomplete description details");
      recommendations.push("Ask seller a clarifying question");
    }

    if (topFactors.length === 0) {
      topFactors.push("Typical category return baseline");
    }
    if (recommendations.length === 0) {
      recommendations.push("Verify shipping & return timelines");
    }

    resultData = {
      returnProbability: probability,
      riskLevel,
      topFactors: topFactors.slice(0, 3),
      recommendations: recommendations.slice(0, 3)
    };
  }

  // 4. Log the prediction for audits
  await logPrediction({
    userId,
    module: "return_intent",
    input: { productId, listingId, category, price, brand, behavior, context },
    output: resultData,
    model: modelUsed,
    source: apiSource,
    latencyMs: Date.now() - started
  });

  return resultData;
}
