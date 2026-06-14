import {
    Router
} from "express";
import {
    z
} from "zod";
import {
    tx,
    query
} from "../db/pool.js";
import {
    asyncHandler,
    validateBody
} from "../middleware/common.js";
import {
    hashPassword,
    verifyPassword,
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    hashToken,
} from "../utils/auth.js";
import {
    config
} from "../config.js";

const router = Router();

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    name: z.string().min(2),
    role: z.enum(["customer", "seller", "enterprise"]).default("customer"),
    city: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

function publicUser(u) {
    return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        city: u.city,
        is_prime: u.is_prime
    };
}

async function issueTokens(user) {
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await query(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)",
        [user.id, hashToken(refreshToken), expires]
    );
    return {
        accessToken,
        refreshToken
    };
}

router.post(
    "/register",
    validateBody(registerSchema),
    asyncHandler(async (req, res) => {
        const {
            email,
            password,
            name,
            role,
            city
        } = req.body;
        const exists = await query("SELECT 1 FROM users WHERE email=$1", [email]);
        if (exists.rowCount) return res.status(409).json({
            error: "Email already registered"
        });

        const user = await tx(async (c) => {
            const {
                rows
            } = await c.query(
                `INSERT INTO users (email, password_hash, name, role, city)
         VALUES ($1,$2,$3,$4,COALESCE($5,'Bengaluru')) RETURNING *`,
                [email, await hashPassword(password), name, role, city]
            );
            const u = rows[0];
            await c.query("INSERT INTO wallets (user_id) VALUES ($1)", [u.id]);
            if (role === "seller") await c.query("INSERT INTO seller_metrics (seller_id) VALUES ($1)", [u.id]);
            return u;
        });

        const tokens = await issueTokens(user);
        res.status(201).json({
            user: publicUser(user),
            ...tokens
        });
    })
);

router.post(
    "/login",
    validateBody(loginSchema),
    asyncHandler(async (req, res) => {
        const {
            email,
            password
        } = req.body;
        const {
            rows
        } = await query("SELECT * FROM users WHERE email=$1", [email]);
        const user = rows[0];
        if (!user || !(await verifyPassword(password, user.password_hash)))
            return res.status(401).json({
                error: "Invalid email or password"
            });
        const tokens = await issueTokens(user);
        res.json({
            user: publicUser(user),
            ...tokens
        });
    })
);

router.post(
    "/refresh",
    validateBody(z.object({
        refreshToken: z.string()
    })),
    asyncHandler(async (req, res) => {
        const {
            refreshToken
        } = req.body;
        let payload;
        try {
            payload = verifyRefreshToken(refreshToken);
        } catch {
            return res.status(401).json({
                error: "Invalid refresh token"
            });
        }
        const {
            rows
        } = await query(
            "SELECT * FROM refresh_tokens WHERE user_id=$1 AND token_hash=$2 AND revoked=FALSE AND expires_at > now()",
            [payload.sub, hashToken(refreshToken)]
        );
        if (!rows[0]) return res.status(401).json({
            error: "Refresh token revoked or expired"
        });

        const {
            rows: urows
        } = await query("SELECT * FROM users WHERE id=$1", [payload.sub]);
        const user = urows[0];
        // Rotate: revoke old, issue new.
        await query("UPDATE refresh_tokens SET revoked=TRUE WHERE id=$1", [rows[0].id]);
        const tokens = await issueTokens(user);
        res.json({
            user: publicUser(user),
            ...tokens
        });
    })
);

router.post(
    "/logout",
    validateBody(z.object({
        refreshToken: z.string()
    })),
    asyncHandler(async (req, res) => {
        await query("UPDATE refresh_tokens SET revoked=TRUE WHERE token_hash=$1", [hashToken(req.body.refreshToken)]);
        res.json({
            ok: true
        });
    })
);

export default router;