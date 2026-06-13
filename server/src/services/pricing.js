// Dynamic Circular Pricing Engine (DCPE) — deterministic.
const GRADE_RETENTION = {
    "A+": 0.78,
    A: 0.68,
    B: 0.55,
    C: 0.38,
    D: 0.18,
    F: 0.05
};
const DEMAND_MULTIPLIER = {
    electronics: 1.08,
    apparel: 1.02,
    home: 0.98
};

export function recommendPrice({
    msrp,
    grade,
    ageMonths,
    category,
    monthlyDepreciation = 0.015
}) {
    const retention = GRADE_RETENTION[grade] || 0.5;
    const demand = DEMAND_MULTIPLIER[category] || 1.0;
    const ageFactor = Math.max(1 - monthlyDepreciation * ageMonths, 0.25);
    const base = msrp * retention * ageFactor * demand;

    const recommended = Math.round(base);
    const floor = Math.round(base * 0.8);
    const ceiling = Math.round(base * 1.12);
    const demandScore = Math.round(Math.min(100, demand * 60 + retention * 40));

    return {
        recommended_price: recommended,
        price_floor: floor,
        price_ceiling: ceiling,
        demand_score: demandScore,
        markdown_schedule: [{
                day: 0,
                price: recommended
            },
            {
                day: 7,
                price: Math.round(recommended * 0.95)
            },
            {
                day: 14,
                price: Math.round(recommended * 0.88)
            },
            {
                day: 21,
                price: floor
            },
        ],
        rationale: `${Math.round(retention * 100)}% MSRP retention for grade ${grade}, ${Math.round(
      (1 - ageFactor) * 100
    )}% age depreciation over ${ageMonths}mo, ${category} demand x${demand.toFixed(2)}.`,
    };
}