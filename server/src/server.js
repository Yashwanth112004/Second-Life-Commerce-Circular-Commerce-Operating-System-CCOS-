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

    const shutdown = async () => {
        console.log("shutting down…");
        server.close();
        await pool.end();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

start();