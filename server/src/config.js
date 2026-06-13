import dotenv from "dotenv";
dotenv.config();

const required = (name, fallback) => {
    const v = process.env[name] || fallback;
    if (v === undefined) throw new Error(`Missing required env var: ${name}`);
    return v;
};

export const config = {
    env: process.env.NODE_ENV || "development",
    port: parseInt(process.env.PORT || "4000", 10),
    corsOrigin: (process.env.CORS_ORIGIN || "http://localhost:5173").split(","),

    databaseUrl: required(
        "DATABASE_URL",
        "postgres://ccos:ccos_dev_password@localhost:5433/ccos"
    ),

    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret",
        refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
        accessTtl: process.env.JWT_ACCESS_TTL || "15m",
        refreshTtl: process.env.JWT_REFRESH_TTL || "30d",
    },

    openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY || "",
        baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
        enabled: !!process.env.OPENROUTER_API_KEY,
        // Text reasoning (listings, root cause, coach, narratives, reports)
        textModel: process.env.TEXT_MODEL || process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free",
        textFallbackModel: process.env.OPENROUTER_FALLBACK_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
        // Vision (damage detection, condition grading) — receives the actual images
        visionModel: process.env.VISION_MODEL || "qwen/qwen3-vl-8b-instruct",
        visionFallbackModel: process.env.VISION_FALLBACK_MODEL || "meta-llama/llama-3.2-11b-vision-instruct",
    },

    storage: {
        driver: process.env.STORAGE_DRIVER || "local",
        cloudinaryUrl: process.env.CLOUDINARY_URL || "",
    },

    seedPassword: process.env.SEED_DEMO_PASSWORD || "Password123!",
};