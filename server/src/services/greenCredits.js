// Green Credits economy (Section 9). 1 GC = 1 kg CO2e prevented; 1 GC = $0.10.
const ACTION_BANDS = {
    resale: [5, 50],
    list: [2, 10],
    buy_preloved: [10, 80],
    donation: [5, 30],
    repair: [15, 100],
    rental: [3, 20],
};

const LEVELS = [
    [0, "Seedling"],
    [101, "Sprout"],
    [501, "Sapling"],
    [2001, "Tree"],
    [10001, "Forest"],
    [50001, "Ecosystem Guardian"],
];

export function creditsForAction(action, carbonSavedKg) {
    const [lo, hi] = ACTION_BANDS[action] || [1, 50];
    return Math.max(lo, Math.min(hi, Math.round(carbonSavedKg)));
}

export function levelForBalance(totalGc) {
    let level = LEVELS[0][1];
    for (const [t, name] of LEVELS)
        if (totalGc >= t) level = name;
    return level;
}

export function nextLevel(totalGc) {
    for (const [t, name] of LEVELS)
        if (totalGc < t) return {
            name,
            gcToNext: Math.round((t - totalGc) * 10) / 10
        };
    return {
        name: null,
        gcToNext: 0
    };
}

/** Apply a credit delta inside a transaction client; returns the ledger row + new balance. */
export async function awardCredits(client, {
    userId,
    delta,
    reason,
    action
}) {
    const {
        rows
    } = await client.query(
        `UPDATE wallets SET green_credits = green_credits + $2, updated_at = now()
     WHERE user_id = $1 RETURNING green_credits`,
        [userId, delta]
    );
    const balance = rows[0].green_credits;
    const {
        rows: tx
    } = await client.query(
        `INSERT INTO green_credit_transactions (user_id, delta, reason, action, balance_after)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [userId, delta, reason, action || null, balance]
    );
    return {
        transaction: tx[0],
        balance
    };
}