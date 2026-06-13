import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import {
    config
} from "./config.js";
import {
    errorHandler,
    notFound
} from "./middleware/common.js";
import {
    UPLOAD_DIR
} from "./middleware/upload.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import productRoutes from "./routes/products.js";
import returnRoutes from "./routes/returns.js";
import marketplaceRoutes from "./routes/marketplace.js";
import aiRoutes from "./routes/ai.js";
import passportRoutes from "./routes/passport.js";
import walletRoutes from "./routes/wallet.js";
import carbonRoutes from "./routes/carbon.js";
import dashboardRoutes from "./routes/dashboards.js";
import adminRoutes from "./routes/admin.js";
import circularRoutes from "./routes/circular.js";
import araRoutes from "./routes/ara.js";
import impactRoutes from "./routes/impact.js";
import donationRoutes from "./routes/donations.js";
import inspectionRoutes from "./routes/inspection.js";
import conciergeRoutes from "./routes/concierge.js";
import demoRoutes from "./routes/demo.js";

export function createApp() {
    const app = express();
    app.set("trust proxy", 1);

    app.use(helmet({
        crossOriginResourcePolicy: {
            policy: "cross-origin"
        }
    }));
    app.use(cors({
        origin: config.corsOrigin,
        credentials: true
    }));
    app.use(express.json({
        limit: "2mb"
    }));
    app.use(morgan(config.env === "development" ? "dev" : "combined"));

    // Global rate limit; auth endpoints get a stricter one.
    app.use("/api", rateLimit({
        windowMs: 60000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false
    }));
    app.use("/api/auth", rateLimit({
        windowMs: 15 * 60000,
        max: 40
    }));

    // Uploaded evidence (local storage driver).
    app.use("/uploads", express.static(UPLOAD_DIR));

    app.get("/api/health", (_req, res) =>
        res.json({
            status: "ok",
            app: "Second Life Commerce API",
            ai_mode: config.openrouter.enabled ? "openrouter" : "fallback (no OPENROUTER_API_KEY)",
            ai_model: config.openrouter.model,
        })
    );

    app.use("/api/auth", authRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/products", productRoutes);
    app.use("/api/returns", returnRoutes);
    app.use("/api/marketplace", marketplaceRoutes);
    app.use("/api/ai", aiRoutes);
    app.use("/api/passport", passportRoutes);
    app.use("/api/wallet", walletRoutes);
    app.use("/api/carbon", carbonRoutes);
    app.use("/api/dashboards", dashboardRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/circular", circularRoutes);
    app.use("/api/ara", araRoutes);
    app.use("/api/impact", impactRoutes);
    app.use("/api/donations", donationRoutes);
    app.use("/api/inspection", inspectionRoutes);
    app.use("/api/concierge", conciergeRoutes);
    app.use("/api/demo", demoRoutes);

    app.use(notFound);
    app.use(errorHandler);
    return app;
}