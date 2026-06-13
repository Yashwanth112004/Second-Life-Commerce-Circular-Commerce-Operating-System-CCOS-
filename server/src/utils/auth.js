import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import {
    config
} from "../config.js";

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash);

export const signAccessToken = (user) =>
    jwt.sign({
        sub: user.id,
        role: user.role,
        email: user.email
    }, config.jwt.accessSecret, {
        expiresIn: config.jwt.accessTtl,
    });

export const signRefreshToken = (user) =>
    jwt.sign({
        sub: user.id,
        type: "refresh"
    }, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshTtl,
    });

export const verifyAccessToken = (token) => jwt.verify(token, config.jwt.accessSecret);
export const verifyRefreshToken = (token) => jwt.verify(token, config.jwt.refreshSecret);

// We store only a hash of refresh tokens.
export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");