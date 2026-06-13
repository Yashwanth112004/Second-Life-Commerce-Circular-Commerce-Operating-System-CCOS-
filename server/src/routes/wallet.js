import {
    Router
} from "express";
import {
    query,
    tx
} from "../db/pool.js";
import {
    requireAuth
} from "../middleware/auth.js";
import {
    asyncHandler
} from "../middleware/common.js";
import {
    levelForBalance,
    nextLevel
} from "../services/greenCredits.js";

const router = Router();
router.use(requireAuth);

router.get(
    "/",
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query("SELECT * FROM wallets WHERE user_id=$1", [req.user.id]);
        const w = rows[0] || {
            green_credits: 0,
            carbon_saved_kg: 0,
            water_saved_l: 0,
            waste_diverted_kg: 0,
            usd_balance: 0
        };
        const rate = 0.05 + Math.min(0.95, (Number(w.carbon_saved_kg) / Math.max(1, Number(w.green_credits))) * 0.1);
        const exchangeRate = Math.round(rate * 10000) / 10000;
        res.json({
            ...w,
            usd_balance: Number(w.usd_balance),
            exchange_rate: exchangeRate,
            cash_value_usd: Math.round(Number(w.green_credits) * exchangeRate * 100) / 100,
            level: levelForBalance(Number(w.green_credits)),
            next_level: nextLevel(Number(w.green_credits)),
        });
    })
);

router.post(
    "/trade-credits",
    asyncHandler(async (req, res) => {
        const { amount, action } = req.body;
        if (typeof amount !== "number" || amount <= 0) {
            return res.status(400).json({ error: "Invalid amount" });
        }
        if (action !== "sell" && action !== "buy") {
            return res.status(400).json({ error: "Invalid action. Must be 'sell' or 'buy'" });
        }

        try {
            const out = await tx(async (c) => {
                const { rows } = await c.query("SELECT * FROM wallets WHERE user_id=$1", [req.user.id]);
                const w = rows[0] || { green_credits: 0, carbon_saved_kg: 0, usd_balance: 0 };
                
                const rate = 0.05 + Math.min(0.95, (Number(w.carbon_saved_kg) / Math.max(1, Number(w.green_credits))) * 0.1);
                const exchangeRate = Math.round(rate * 10000) / 10000;

                if (action === "sell") {
                    if (Number(w.green_credits) < amount) {
                        throw new Error("Insufficient Green Credits to complete swap");
                    }
                    const usdEarned = Math.round(amount * exchangeRate * 100) / 100;
                    
                    await c.query(
                        `UPDATE wallets 
                         SET green_credits = green_credits - $2, 
                             usd_balance = usd_balance + $3, 
                             updated_at = now() 
                         WHERE user_id = $1`,
                        [req.user.id, amount, usdEarned]
                    );

                    const { rows: updated } = await c.query("SELECT green_credits FROM wallets WHERE user_id=$1", [req.user.id]);
                    const balanceAfter = updated[0].green_credits;

                    await c.query(
                        `INSERT INTO green_credit_transactions (user_id, delta, reason, action, balance_after) 
                         VALUES ($1, $2, $3, 'trade_credits', $4)`,
                        [
                            req.user.id,
                            -amount,
                            `Swapped ${amount} GC for $${usdEarned.toFixed(2)} USD Tokens (Rate: $${exchangeRate.toFixed(4)}/GC)`,
                            balanceAfter
                        ]
                    );

                    return { usdEarned, exchangeRate };
                } else {
                    // buy
                    const usdCost = Math.round(amount * exchangeRate * 100) / 100;
                    if (Number(w.usd_balance) < usdCost) {
                        throw new Error("Insufficient USD Token balance to purchase Green Credits");
                    }

                    await c.query(
                        `UPDATE wallets 
                         SET green_credits = green_credits + $2, 
                             usd_balance = usd_balance - $3, 
                             updated_at = now() 
                         WHERE user_id = $1`,
                        [req.user.id, amount, usdCost]
                    );

                    const { rows: updated } = await c.query("SELECT green_credits FROM wallets WHERE user_id=$1", [req.user.id]);
                    const balanceAfter = updated[0].green_credits;

                    await c.query(
                        `INSERT INTO green_credit_transactions (user_id, delta, reason, action, balance_after) 
                         VALUES ($1, $2, $3, 'trade_credits', $4)`,
                        [
                            req.user.id,
                            amount,
                            `Purchased ${amount} GC for $${usdCost.toFixed(2)} USD Tokens (Rate: $${exchangeRate.toFixed(4)}/GC)`,
                            balanceAfter
                        ]
                    );

                    return { usdCost, exchangeRate };
                }
            });

            res.json({ ok: true, ...out });
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    })
);

router.get(
    "/history",
    asyncHandler(async (req, res) => {
        const {
            rows
        } = await query(
            "SELECT delta, reason, action, balance_after, created_at FROM green_credit_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
            [req.user.id]
        );
        res.json(rows);
    })
);

export default router;