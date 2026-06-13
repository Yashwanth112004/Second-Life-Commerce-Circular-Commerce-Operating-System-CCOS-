import { chatJSON } from "./openrouter.js";
import { logPrediction } from "../aiLog.js";

/**
 * Return Fraud Detector (RFD) - Module 12
 * Detects return fraud in real-time based on history, networks, and anomalies.
 */
export async function detectReturnFraud(db, {
  userId,
  returnId,
  orderId,
  category = "electronics",
  price = 100,
  weightDiscrepancy = false,
  accountAgeDays = 90
}) {
  const started = Date.now();
  let result;
  let source = "fallback";
  let model = "deterministic_rules";

  // 1. Fetch user's return history statistics
  let returnStats = { total_orders: 1, total_returns: 0, return_rate: 0.0 };
  try {
    const { rows } = await db(
      `SELECT 
         COUNT(*)::int AS total_orders,
         COUNT(CASE WHEN status IN ('return_initiated', 'donated', 'recycled', 'exchanged', 'listed') THEN 1 END)::int AS total_returns
       FROM orders WHERE user_id = $1`,
      [userId]
    );
    if (rows[0] && rows[0].total_orders > 0) {
      returnStats = {
        total_orders: rows[0].total_orders,
        total_returns: rows[0].total_returns,
        return_rate: Number((rows[0].total_returns / rows[0].total_orders).toFixed(2))
      };
    }
  } catch (e) {
    console.warn("[RFD] Failed to fetch user return history:", e.message);
  }

  // 2. Fetch linked accounts (linked by same zip code or location)
  let linkedAccountsCount = 0;
  try {
    const { rows: userRows } = await db("SELECT city, zip_code FROM users WHERE id=$1", [userId]);
    if (userRows[0] && userRows[0].zip_code) {
      const { rows: linkRows } = await db("SELECT COUNT(*)::int FROM users WHERE zip_code = $1 AND id <> $2", [userRows[0].zip_code, userId]);
      linkedAccountsCount = linkRows[0] ? linkRows[0].count : 0;
    }
  } catch (e) {
    console.warn("[RFD] Failed to fetch linked accounts:", e.message);
  }

  // Try OpenRouter AI
  try {
    const system = `You are the CCOS Return Fraud Detector (RFD) AI.
Analyze return risk patterns and classify fraud types.
Respond ONLY with a JSON object matching this exact structure:
{
  "fraudProbability": 15,
  "fraudType": "none", // "none" | "empty_box" | "wardrobing" | "switch_fraud" | "serial_returner"
  "recommendedAction": "approve", // "approve" | "hold" | "investigate" | "deny"
  "reasoning": "Standard return pattern with verified weight matches.",
  "details": {
    "anomalyDetected": false,
    "linkedRingRisk": "low",
    "weightMatch": true
  }
}`;

    const userPrompt = `Evaluate Return Fraud:
User ID: ${userId}
Return ID: ${returnId}
Category: ${category}
Price: $${price}
Weight Discrepancy: ${weightDiscrepancy}
User Stats: Total Orders=${returnStats.total_orders}, Total Returns=${returnStats.total_returns}, Rate=${returnStats.return_rate}
Account Age: ${accountAgeDays} days
Linked Accounts in Zip: ${linkedAccountsCount}`;

    const aiRes = await chatJSON({ system, user: userPrompt });
    result = aiRes.data;
    source = aiRes.source;
    model = aiRes.model;
  } catch (e) {
    // Fallback formula
    let fraudProbability = 5;
    let fraudType = "none";
    let recommendedAction = "approve";
    let reasoning = "Approved: Return patterns look normal and weight checks matched.";

    if (weightDiscrepancy) {
      fraudProbability += 45;
      fraudType = "switch_fraud";
      reasoning = "Flagged switch fraud: Physical item weight differs significantly from manufacturing specifications.";
    }

    if (returnStats.return_rate > 0.5 && returnStats.total_returns >= 3) {
      fraudProbability += 30;
      fraudType = "serial_returner";
      reasoning = "Flagged serial returner: User has a historical return rate exceeding 50%.";
    }

    if (price > 500 && accountAgeDays < 30) {
      fraudProbability += 20;
      reasoning = "Investigating high-value return on brand new account.";
    }

    if (linkedAccountsCount > 5) {
      fraudProbability += 15;
    }

    // Clamp
    fraudProbability = Math.min(99, fraudProbability);

    if (fraudProbability >= 75) {
      recommendedAction = "deny";
    } else if (fraudProbability >= 50) {
      recommendedAction = "investigate";
    } else if (fraudProbability >= 30) {
      recommendedAction = "hold";
    }

    result = {
      fraudProbability,
      fraudType,
      recommendedAction,
      reasoning,
      details: {
        anomalyDetected: fraudProbability > 30,
        linkedRingRisk: linkedAccountsCount > 5 ? "medium" : "low",
        weightMatch: !weightDiscrepancy
      }
    };
  }

  // 3. Write fraud case to fraud_cases table if probability is medium/high (>= 30%)
  if (result.fraudProbability >= 30) {
    try {
      await db(
        `INSERT INTO fraud_cases (return_id, user_id, fraud_type, risk_score, status, detail)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [returnId, userId, result.fraudType, Number((result.fraudProbability / 100).toFixed(3)), result.recommendedAction === "deny" ? "closed_denied" : "open", JSON.stringify(result)]
      );
    } catch (e) {
      console.error("[RFD] Failed to write fraud case to database:", e.message);
    }
  }

  // Log to ai_predictions
  await logPrediction({
    userId,
    module: "fraud_detection",
    input: { returnId, orderId, category, price, weightDiscrepancy },
    output: result,
    model,
    source,
    latencyMs: Date.now() - started
  });

  return result;
}
