// Digital Product Twin — forecasts an item's resale value trajectory and the
// optimal resale window, using the same deterministic depreciation model as DCPE.
import {
    recommendPrice
} from "./pricing.js";

export function productTwin({
    msrp,
    grade,
    ageMonths,
    category,
    monthlyDepreciation
}) {
    const g = grade || "B";
    const valueAt = (extra) =>
        recommendPrice({
            msrp,
            grade: g,
            ageMonths: ageMonths + extra,
            category,
            monthlyDepreciation,
        }).recommended_price;

    const now = valueAt(0);
    const curve = [];
    for (let m = 0; m <= 12; m++) curve.push({
        month: m,
        value: valueAt(m)
    });

    const m3 = valueAt(3);
    const m6 = valueAt(6);
    const m12 = valueAt(12);

    const depreciation12 = now > 0 ? Math.round((1 - m12 / now) * 100) : 0;
    const monthlyDecayPct = now > 0 ? Math.round(((1 - m3 / now) / 3) * 100) : 0;

    let bestWindow, recommendation;
    if (monthlyDecayPct >= 2) {
        bestWindow = "now";
        recommendation = "Sell now — this item is losing value quickly.";
    } else if (monthlyDecayPct >= 1) {
        bestWindow = "within 3 months";
        recommendation = "List within ~3 months to capture most of the value.";
    } else {
        bestWindow = "next 6–12 months";
        recommendation = "Value is stable — hold or sell whenever convenient.";
    }

    return {
        current_value: now,
        forecast: {
            m3,
            m6,
            m12
        },
        curve,
        depreciation_12mo_pct: depreciation12,
        monthly_decay_pct: monthlyDecayPct,
        best_resale_window: bestWindow,
        recommendation,
    };
}