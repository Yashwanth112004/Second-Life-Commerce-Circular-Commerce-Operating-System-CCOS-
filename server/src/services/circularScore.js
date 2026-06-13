// Circular Score — a 0-100 measure of a user's circular-economy impact.
// Deterministic, capped contributions so no single action dominates.

const TIERS = [
    [0, "Beginner"],
    [20, "Recycler"],
    [40, "Advocate"],
    [60, "Champion"],
    [80, "Legend"],
];

export function tierFor(score) {
    let t = TIERS[0][1];
    for (const [threshold, name] of TIERS)
        if (score >= threshold) t = name;
    return t;
}

export function computeScore({
    resells,
    donations,
    repairs,
    prelovedBuys,
    carbonKg,
    wasteKg
}) {
    const breakdown = {
        resells: Math.min((resells || 0) * 6, 30),
        donations: Math.min((donations || 0) * 5, 20),
        repairs: Math.min((repairs || 0) * 8, 24),
        preloved_purchases: Math.min((prelovedBuys || 0) * 4, 16),
        carbon_saved: Math.min((carbonKg || 0) * 0.05, 20),
        waste_diverted: Math.min((wasteKg || 0) * 0.2, 10),
    };
    const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
    const score = Math.max(0, Math.min(100, Math.round(raw)));
    return {
        score,
        tier: tierFor(score),
        breakdown
    };
}

// Pulls per-user aggregates for everyone (small N) so we can rank.
export async function scoreAllUsers(query) {
    const {
        rows
    } = await query(`
    SELECT u.id, u.name, u.city,
      (SELECT COUNT(*) FROM returns r WHERE r.user_id=u.id AND r.chosen_path='resell') resells,
      (SELECT COUNT(*) FROM donations d WHERE d.donor_id=u.id) donations,
      (SELECT COUNT(*) FROM returns r WHERE r.user_id=u.id AND r.chosen_path='repair') repairs,
      (SELECT COUNT(*) FROM green_credit_transactions g WHERE g.user_id=u.id AND g.action='buy_preloved') preloved,
      COALESCE((SELECT SUM(carbon_saved_kg) FROM carbon_events c WHERE c.user_id=u.id),0) carbon,
      COALESCE((SELECT SUM(waste_diverted_kg) FROM carbon_events c WHERE c.user_id=u.id),0) waste
    FROM users u WHERE u.role IN ('customer','seller')
  `);
    const scored = rows.map((r) => {
        const s = computeScore({
            resells: Number(r.resells),
            donations: Number(r.donations),
            repairs: Number(r.repairs),
            prelovedBuys: Number(r.preloved),
            carbonKg: Number(r.carbon),
            wasteKg: Number(r.waste),
        });
        return {
            id: r.id,
            name: r.name,
            city: r.city,
            score: s.score,
            tier: s.tier,
            breakdown: s.breakdown
        };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored;
}