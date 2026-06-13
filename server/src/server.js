import {
    createApp
} from "./app.js";
import {
    config
} from "./config.js";
import {
    migrate
} from "./db/migrate.js";
import {
    pool
} from "./db/pool.js";
import {
    autoRepriceListings,
    runAllAutonomousAgents
} from "./routes/ara.js";

async function start() {
    // Apply schema on boot (idempotent). For controlled deploys, run `npm run migrate` instead.
    try {
        await migrate();
        console.log("✓ schema ready");
    } catch (e) {
        console.error("✗ migration failed:", e.message);
        process.exit(1);
    }

    const app = createApp();
    const server = app.listen(config.port, () => {
        console.log(`✓ CCOS API on http://localhost:${config.port}  (env=${config.env}, ai=${config.openrouter.enabled ? "openrouter" : "fallback"})`);
    });

    // Run dynamic pricing auto-repricer on startup and then every 15 minutes
    autoRepriceListings((sql, params) => pool.query(sql, params)).catch((e) => {
        console.error("[Reprice Boot] Failed to run auto repricing on startup:", e.message);
    });

    // Run all autonomous agent loops on startup
    runAllAutonomousAgents((sql, params) => pool.query(sql, params)).catch((e) => {
        console.error("[ARA Boot] Failed to run all agents on startup:", e.message);
    });
    
    const repriceInterval = setInterval(() => {
        autoRepriceListings((sql, params) => pool.query(sql, params)).catch((e) => {
            console.error("[Reprice Interval] Failed to run periodic auto repricing:", e.message);
        });
    }, 15 * 60 * 1000);

    const araInterval = setInterval(() => {
        runAllAutonomousAgents((sql, params) => pool.query(sql, params)).catch((e) => {
            console.error("[ARA Interval] Failed to run periodic agent sweep:", e.message);
        });
    }, 15 * 60 * 1000);

    const shutdown = async () => {
        console.log("shutting down…");
        clearInterval(repriceInterval);
        clearInterval(araInterval);
        server.close();
        await pool.end();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

start();