import { chatJSON } from "./openrouter.js";
import { logPrediction } from "../aiLog.js";

/**
 * Smart Size Advisor (SSA) - Module 8
 * Predicts the ideal size for a customer for any apparel, footwear, or wearable item.
 */
export async function adviseSize(db, {
  userId,
  productId,
  brand = "Generic",
  category = "apparel",
  fitPreference = "regular"
}) {
  const started = Date.now();
  let result;
  let source = "fallback";
  let model = "deterministic_rules";

  // 1. Fetch user sizing profile
  let sizePreference = "M";
  let bodyMeasurements = { chest_inches: 38, waist_inches: 32, height_inches: 70 };
  try {
    const { rows } = await db("SELECT size_preference, size_preference AS size FROM users WHERE id=$1", [userId]);
    if (rows[0] && rows[0].size) {
      sizePreference = rows[0].size;
    }
  } catch (e) {
    console.warn("[SSA] Failed to fetch user size preference:", e.message);
  }

  // 2. Fetch product's category and size
  let productSize = "M";
  try {
    const { rows } = await db("SELECT size, category, brand FROM products WHERE id=$1", [productId]);
    if (rows[0] && rows[0].size) {
      productSize = rows[0].size;
    }
  } catch (e) {
    console.warn("[SSA] Failed to fetch product details:", e.message);
  }

  // Try OpenRouter AI
  try {
    const system = `You are the Smart Size Advisor (SSA) AI.
Predict the ideal size for a customer based on preferences, historical brand fit, and fabric attributes.
Respond ONLY with a JSON object matching this exact structure:
{
  "recommendedSize": "M",
  "confidenceScore": 92,
  "fitPrediction": "Regular Fit",
  "alternativeSizes": [
    { "size": "S", "tradeoff": "Slimmer fit, shorter length" },
    { "size": "L", "tradeoff": "Relaxed fit, extra sleeve room" }
  ],
  "reasoning": "Fits true to size. Fabric stretch provides comfortable regular fit."
}`;

    const userPrompt = `Predict ideal size for:
Brand: ${brand}
Category: ${category}
User size preference: ${sizePreference}
Target product size cataloged: ${productSize}
Fit preference: ${fitPreference}
Body measurements: Chest 38\", Waist 32\", Height 70\"`;

    const aiRes = await chatJSON({ system, user: userPrompt });
    result = aiRes.data;
    source = aiRes.source;
    model = aiRes.model;
  } catch (e) {
    // Fallback formula
    const recommendedSize = sizePreference || productSize || "M";
    const confidenceScore = brand === "Nike" || brand === "Adidas" ? 88 : 92;
    const fitPrediction = fitPreference === "slim" ? "Slim Fit" : (fitPreference === "relaxed" ? "Relaxed Fit" : "Regular Fit");
    
    // Alt sizes
    const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
    const idx = sizes.indexOf(recommendedSize);
    const alternativeSizes = [];
    if (idx > 0) {
      alternativeSizes.push({ size: sizes[idx - 1], tradeoff: "Tighter/slimmer fit, shorter cut" });
    }
    if (idx < sizes.length - 1) {
      alternativeSizes.push({ size: sizes[idx + 1], tradeoff: "Looser/oversized fit, longer drape" });
    }

    result = {
      recommendedSize,
      confidenceScore,
      fitPrediction,
      alternativeSizes,
      reasoning: `Fits true to size. Based on your standard ${recommendedSize} preference and a ${fitPreference} fit profile.`
    };
  }

  // Log to ai_predictions
  await logPrediction({
    userId,
    module: "size_advisor",
    input: { productId, brand, category, fitPreference, userSizePreference: sizePreference },
    output: result,
    model,
    source,
    latencyMs: Date.now() - started
  });

  return result;
}
