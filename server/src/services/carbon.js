// Carbon Footprint Calculator (CFCA) — deterministic LCA-style math.
// carbon_saved = embedded_mfg * remaining_life(grade) + avoided_reorder - route_logistics

const REMAINING_LIFE = {
    "A+": 0.95,
    A: 0.85,
    B: 0.65,
    C: 0.4,
    D: 0.15,
    F: 0.05
};
const ROUTE_LOGISTICS = {
    zero_warehouse: 1.1,
    local_hub: 2.0,
    regional_warehouse: 4.5,
    donation_local: 1.4,
};
const WATER_PER_KG = 90.0;

export function equivalents(carbonKg) {
    const miles = carbonKg / 0.404;
    const trees = carbonKg / 21.77;
    const phone = carbonKg / 0.0083;
    return {
        driving: `like not driving ${miles.toFixed(1)} miles`,
        trees: `equal to ${trees.toFixed(2)} tree-years of CO\u2082 absorption`,
        phone_charges: `${Math.round(phone)} smartphone charges avoided`,
    };
}

export function calculateCarbon({
    embeddedCarbonKg,
    weightKg,
    grade = "A",
    route = "zero_warehouse",
    action = "resale",
}) {
    const remaining = REMAINING_LIFE[grade] || 0.6;
    const avoidedManufacturing = embeddedCarbonKg * remaining;
    const avoidedDoubleShipping = action === "donation" ? 0 : 2.6;
    const logistics = ROUTE_LOGISTICS[route] || 2.0;

    const carbonSaved = Math.max(
        Math.round((avoidedManufacturing + avoidedDoubleShipping - logistics) * 100) / 100,
        0.1
    );
    return {
        carbon_saved_kg: carbonSaved,
        water_saved_l: Math.round(weightKg * WATER_PER_KG * remaining * 10) / 10,
        waste_diverted_kg: Math.round(weightKg * 100) / 100,
        manufacturing_avoided_kg: Math.round(avoidedManufacturing * 100) / 100,
        avoided_double_shipping_kg: avoidedDoubleShipping,
        circular_logistics_kg: logistics,
        equivalents: equivalents(carbonSaved),
    };
}