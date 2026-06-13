import {
    verifyAccessToken
} from "../utils/auth.js";
import {
    query
} from "../db/pool.js";

/** Require a valid access token; attaches req.user (db row). */
export async function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : null;
        if (!token) return res.status(401).json({
            error: "Missing access token"
        });
        const payload = verifyAccessToken(token);
        const {
            rows
        } = await query(
            "SELECT id, email, name, role, city, zip_code, is_prime FROM users WHERE id=$1",
            [payload.sub]
        );
        if (!rows[0]) return res.status(401).json({
            error: "User not found"
        });
        req.user = rows[0];
        next();
    } catch {
        return res.status(401).json({
            error: "Invalid or expired token"
        });
    }
}

/** Restrict to specific roles (use after requireAuth). */
export const requireRole =
    (...roles) =>
    (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role))
            return res.status(403).json({
                error: "Forbidden: insufficient role"
            });
        next();
    };