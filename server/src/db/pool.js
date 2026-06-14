import pg from "pg";
import {
    config
} from "../config.js";

// NUMERIC -> JS number (safe for our value ranges; revisit for money-critical paths).
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

export const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    ssl: config.databaseUrl.includes("neon.tech") || config.env === "production"
        ? { rejectUnauthorized: false }
        : false,
});

export const query = (text, params) => pool.query(text, params);

/** Run a function inside a transaction. */
export async function tx(fn) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}