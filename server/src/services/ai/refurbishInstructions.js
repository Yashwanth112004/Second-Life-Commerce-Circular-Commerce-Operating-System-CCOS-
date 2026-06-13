import { chatJSON } from "./openrouter.js";
import { logPrediction } from "../aiLog.js";

/**
 * Real-Time Refurbishment Instruction Generator (RRIG) - Module 25
 * Generates illustrated, step-by-step instructions for refurbishing items at circular hubs.
 */
export async function generateRefurbishInstructions(db, {
  returnId,
  userId,
  skillLevel = "intermediate",
  availableTools = ["cleaning cloth", "screwdrivers"]
}) {
  const started = Date.now();
  let result;
  let source = "fallback";
  let model = "deterministic_rules";

  // 1. Fetch return details and assessment from database
  let ret = { title: "Generic Product", category: "electronics", brand: "Generic", msrp: 100 };
  let assessment = { grade: "B", grade_label: "Good", severity: 2.0, reasoning: "" };
  let damages = [];

  try {
    const { rows: retRows } = await db(
      `SELECT r.id, o.product_id, p.title, p.brand, p.category, p.msrp
       FROM returns r 
       JOIN orders o ON o.id = r.order_id 
       JOIN products p ON p.id = o.product_id 
       WHERE r.id = $1`,
      [returnId]
    );
    if (retRows[0]) ret = retRows[0];

    const { rows: assessRows } = await db(
      `SELECT * FROM return_assessments WHERE return_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [returnId]
    );
    if (assessRows[0]) {
      assessment = assessRows[0];
      const { rows: dmgRows } = await db(
        `SELECT label, severity, location FROM damage_detections WHERE assessment_id = $1`,
        [assessment.id]
      );
      damages = dmgRows;
    }
  } catch (e) {
    console.warn("[RRIG] Database lookup failed:", e.message);
  }

  // 2. Query OpenRouter AI
  try {
    const system = `You are the CCOS Real-Time Refurbishment Instruction Generator (RRIG) AI.
Generate detailed, step-by-step instructions for warehouse operators to repair or refurbish returned items.
Respond ONLY with a JSON object matching this exact structure:
{
  "instructions": [
    {
      "step": 1,
      "title": "Clean Chassis",
      "action": "Spray casing with isopropyl alcohol and wipe clean using microfiber cloth.",
      "est_time_mins": 3,
      "illustration_prompt": "Vector icon of wiping camera body with a cloth"
    }
  ],
  "partsRequired": ["Microfiber cloth", "Isopropyl alcohol"],
  "totalEstimatedTimeMin": 15,
  "qualityCheckCriteria": ["Verify outer shell is dust-free", "Check lens for fingerprints"],
  "safetyWarnings": ["Avoid direct alcohol spray into optical lenses"]
}`;

    const userPrompt = `Generate instructions for:
Product: ${ret.brand} ${ret.title} (Category: ${ret.category}, MSRP: $${ret.msrp})
Assessment Grade: ${assessment.grade} (${assessment.grade_label})
Damages Detected: ${damages.map(d => `${d.label} (severity: ${d.severity}/10 at ${d.location || "n/a"})`).join(", ") || "None"}
Operator Skill Level: ${skillLevel}
Available Tools: ${availableTools.join(", ")}`;

    const aiRes = await chatJSON({ system, user: userPrompt });
    result = aiRes.data;
    source = aiRes.source;
    model = aiRes.model;
  } catch (e) {
    // Fallback formula
    const isApparel = ret.category.toLowerCase() === "apparel";
    
    if (isApparel) {
      result = {
        instructions: [
          { step: 1, title: "Fiber Sanitization", action: "Steam sanitization at 130°C to eliminate micro-particles and restore texture.", est_time_mins: 5, illustration_prompt: "Sanitization vector illustration" },
          { step: 2, title: "Thread Dressing", action: "Snip all loose hem lines and resew any seam issues using matched yarn.", est_time_mins: 10, illustration_prompt: "Sewing thread vector" },
          { step: 3, title: "Repackaging", action: "Perform folding inspection and insert into a clean recycled packaging sleeve.", est_time_mins: 2, illustration_prompt: "Folding clothing into box" }
        ],
        partsRequired: ["Cotton yarn", "Recycled packaging box", "Steam sanitizer water"],
        totalEstimatedTimeMin: 17,
        qualityCheckCriteria: ["Verify stitching tension", "Zero dust/odors detected", "Folded presentation aligns with circular brand guidelines"],
        safetyWarnings: ["Use care with hot steam ironing wand", "Ensure operator gloves are worn to prevent oil transfer"]
      };
    } else {
      result = {
        instructions: [
          { step: 1, title: "Chemical Cleanse", action: "Clean chassis surfaces using microfiber cloth and 90% Isopropyl Alcohol.", est_time_mins: 5, illustration_prompt: "Wiping device surface" },
          { step: 2, title: "Dust Purge", action: "Blow compressed air into vents, USB/charging ports, and cracks.", est_time_mins: 3, illustration_prompt: "Compressed air spray can" },
          { step: 3, title: "Battery Cycle Test", action: "Connect test rig to check battery impedance and boot cycle validation.", est_time_mins: 15, illustration_prompt: "Motherboard diagnostics rig" }
        ],
        partsRequired: ["Isopropyl Alcohol", "Microfiber cloth", "Compressed air can"],
        totalEstimatedTimeMin: 23,
        qualityCheckCriteria: ["Casing scuff marks cleared", "Power consumption limits verified", "Stable boot sequence confirmed"],
        safetyWarnings: ["Observe strict electrostatic discharge grounding regulations", "Handle battery pack carefully to prevent short-circuiting"]
      };
    }
  }

  // Log prediction to predictions table
  await logPrediction({
    userId,
    module: "refurbish_instructions",
    input: { returnId, skillLevel, availableTools },
    output: result,
    model,
    source,
    latencyMs: Date.now() - started
  });

  return result;
}
