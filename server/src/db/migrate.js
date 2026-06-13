import {
    readFileSync
} from "node:fs";
import {
    fileURLToPath
} from "node:url";
import {
    dirname,
    join
} from "node:path";
import {
    pool
} from "./pool.js";

const __dirname = dirname(fileURLToPath(
    import.meta.url));

export async function migrate() {
    const sql = readFileSync(join(__dirname, "schema.sql"), "utf8");
    await pool.query(sql);
}

// Allow `npm run migrate`.
const invokedDirectly = String(process.argv[1] || "").endsWith("migrate.js");
if (invokedDirectly) {
    migrate()
        .then(() => {
            console.log("✓ schema migrated");
            return pool.end();
        })
        .catch((e) => {
            console.error("migration failed:", e.message);
            process.exit(1);
        });
}