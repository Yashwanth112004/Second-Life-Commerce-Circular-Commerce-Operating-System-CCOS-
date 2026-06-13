// Circular Economy Score (CES) — product-level.
// Formula: Repairability + Recyclability + Resale Demand + Longevity + Carbon Efficiency
// Each dimension 0–100, weighted equally; CES = average.

const REPAIRABILITY = {
    electronics: 60,
    apparel: 72,
    home: 80
};
const RECYCLABILITY = {
    electronics: 55,
    apparel: 85,
    home: 70
};
const LONGEVITY = {
    electronics: 65,
    apparel: 78,
    home: 88
};
const CARBON_EFF = {
    electronics: 50,
    apparel: 70,
    home: 60
};

export function computeCES({
    category,
    ecoScore,
    grade,
    ageMonths
}) {
    const repairability = (REPAIRABILITY[category] || 65) + (ecoScore > 70 ? 10 : 0);
    const recyclability = RECYCLABILITY[category] || 70;
    const gradeBonus = {
        "A+": 18,
        A: 14,
        B: 8,
        C: 2,
        D: -5,
        F: -15
    };
    const resaleDemand = 70 + (gradeBonus[grade] || 0);
    const longevity = (LONGEVITY[category] || 75) - Math.min(ageMonths * 0.5, 15);
    const carbonEfficiency = (CARBON_EFF[category] || 60) + Math.round(ecoScore * 0.25);

    const dims = {
        repairability,
        recyclability,
        resale_demand: resaleDemand,
        longevity: Math.round(longevity),
        carbon_efficiency: carbonEfficiency
    };
    const vals = Object.values(dims);
    const score = Math.max(0, Math.min(100, Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)));
    return {
        score,
        breakdown: dims
    };
}