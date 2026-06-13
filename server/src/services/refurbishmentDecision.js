/**
 * Refurbishment Decision Engine (RDE)
 * Calculates the best disposition path for a returned/owned item.
 */

export async function evaluateRDE(db, {
  grade = "B",
  severity = 0,
  packagingScore = 80,
  category = "electronics",
  msrp = 100,
  weight = 1.0,
  carbonSaved = 5,
  refurbishCost = null,
  logisticsCost = 15
}) {
  const itemMsrp = Number(msrp || 100);
  const itemWeight = Number(weight || 1.0);
  const baseCarbon = Number(carbonSaved || 5);
  const severityScore = Number(severity || 0);
  const pkgScore = Number(packagingScore || 80);

  // 1. Determine demand & category variables
  let categoryDepreciation = 0.015;
  let demandScore = 75;
  if (category === "electronics") {
    categoryDepreciation = 0.02;
    demandScore = 80;
  } else if (category === "apparel") {
    categoryDepreciation = 0.012;
    demandScore = 70;
  } else if (category === "home") {
    categoryDepreciation = 0.01;
    demandScore = 65;
  }

  // 2. Financial inputs
  const calculatedRefurbCost = refurbishCost !== null ? Number(refurbishCost) : Math.round(itemMsrp * 0.12);
  const actualLogisticsCost = Number(logisticsCost || 15);

  // 3. Resale values (As-is vs Refurbished)
  // Grade multipliers
  const GRADE_MULTIPLIERS = { "A+": 0.82, "A": 0.70, "B": 0.55, "C": 0.38, "D": 0.18, "F": 0.05 };
  
  const currentMultiplier = GRADE_MULTIPLIERS[grade] || 0.55;
  const resellAsIsPrice = Math.round(itemMsrp * currentMultiplier);
  const resellAsIsProfit = Math.max(0, resellAsIsPrice - actualLogisticsCost);

  // Refurbished path: lifts grade up by 1 or 2 steps if grade is low
  let refurbishedGrade = grade;
  if (grade === "D") refurbishedGrade = "B";
  else if (grade === "C") refurbishedGrade = "B";
  else if (grade === "B") refurbishedGrade = "A";
  else if (grade === "A") refurbishedGrade = "A+";

  const refurbishedMultiplier = GRADE_MULTIPLIERS[refurbishedGrade] || currentMultiplier;
  const refurbishedPrice = Math.round(itemMsrp * refurbishedMultiplier);
  const refurbishedProfit = Math.max(0, refurbishedPrice - calculatedRefurbCost - actualLogisticsCost);

  // 4. Matrix calculation
  // Path 1: Resell As-Is
  const pathAsIs = {
    profit: resellAsIsProfit,
    carbon_savings: Math.round(baseCarbon * 10) / 10,
    waste_reduction: Math.round(80 * (pkgScore / 100))
  };

  // Path 2: Refurbish & Resell
  const pathRefurb = {
    profit: refurbishedProfit,
    carbon_savings: Math.round((baseCarbon + itemWeight * 0.5) * 10) / 10,
    waste_reduction: Math.round(90 * (pkgScore / 100))
  };

  // Path 3: Donate
  const taxBenefitValue = Math.round(resellAsIsPrice * 0.6);
  const pathDonate = {
    impact_score: Math.min(99, Math.round(demandScore + (100 - severityScore * 10) * 0.2)),
    tax_benefit: taxBenefitValue,
    carbon_savings: Math.round((baseCarbon * 0.95) * 10) / 10
  };

  // Path 4: Recycle
  const pathRecycle = {
    impact_score: Math.min(50, Math.round(35 + (pkgScore * 0.15))),
    waste_reduction: 95,
    carbon_savings: Math.round((baseCarbon * 0.3) * 10) / 10
  };

  // 5. Decision Logic
  let recommended = "resell";
  let explanation = "";
  let confidence = 85;

  if (grade === "F" || severityScore > 8) {
    recommended = "donate";
    explanation = "Severe physical damage detected. Refurbishment is uneconomical; donating redirects components for parts and local redistribution, maximizing community impact.";
    confidence = 90;
  } else if (grade === "D" || (severityScore > 4 && refurbishedProfit > resellAsIsProfit + 10)) {
    recommended = "repair"; // matches path 'repair' (Refurbish & Resell)
    explanation = `Refurbishing this item will cost ₹${calculatedRefurbCost} but upgrades the grade from ${grade} to ${refurbishedGrade}, increasing the resale profit by ₹${refurbishedProfit - resellAsIsProfit} and keeping materials in circulation longer.`;
    confidence = 92;
  } else if (resellAsIsProfit > refurbishedProfit && resellAsIsProfit > 15) {
    recommended = "resell"; // matches path 'resell' (Resell As-Is)
    explanation = `Item is in healthy condition (${grade}). Immediate resale is recommended to avoid unnecessary repair overhead, capturing ₹${resellAsIsProfit} net profit with regional delivery.`;
    confidence = 88;
  } else {
    recommended = "donate";
    explanation = "Low resale value makes logistics uneconomical. Donating earns ₹" + taxBenefitValue + " in tax benefits and supports local community needs.";
    confidence = 85;
  }

  // Adjust confidence slightly if packaging condition is bad
  if (pkgScore < 50) {
    confidence = Math.max(50, confidence - 8);
  }

  return {
    matrix: {
      resell_as_is: pathAsIs,
      refurbish_resell: pathRefurb,
      donate: pathDonate,
      recycle: pathRecycle
    },
    recommended,
    confidence,
    explanation
  };
}
