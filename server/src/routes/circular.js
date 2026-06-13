import {
    Router
} from "express";
import {
    query
} from "../db/pool.js";
import {
    requireAuth
} from "../middleware/auth.js";
import {
    asyncHandler
} from "../middleware/common.js";
import {
    scoreAllUsers
} from "../services/circularScore.js";

const router = Router();
router.use(requireAuth);

router.get(
    "/score",
    asyncHandler(async (req, res) => {
        const all = scoreAllUsers ? await scoreAllUsers(query) : [];
        const idx = all.findIndex((u) => u.id === req.user.id);
        const me = idx >= 0 ? all[idx] : {
            score: 0,
            tier: "Beginner",
            breakdown: {}
        };
        const cityList = all.filter((u) => u.city === req.user.city);
        const cityIdx = cityList.findIndex((u) => u.id === req.user.id);
        const percentile = all.length > 1 ? Math.round((1 - idx / (all.length - 1)) * 100) : 100;

        res.json({
            score: me.score,
            tier: me.tier,
            breakdown: me.breakdown,
            global_rank: idx >= 0 ? idx + 1 : null,
            global_total: all.length,
            city_rank: cityIdx >= 0 ? cityIdx + 1 : null,
            city_total: cityList.length,
            city: req.user.city,
            percentile,
        });
    })
);

router.get(
    "/leaderboard",
    asyncHandler(async (req, res) => {
        const all = await scoreAllUsers(query);
        res.json(all.slice(0, 10).map((u, i) => ({
            rank: i + 1,
            name: u.name,
            city: u.city,
            score: u.score,
            tier: u.tier
        })));
    })
);

export default router;