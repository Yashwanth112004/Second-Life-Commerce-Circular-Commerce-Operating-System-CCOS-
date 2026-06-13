import {
    migrate
} from "./migrate.js";
import {
    pool,
    tx
} from "./pool.js";
import {
    hashPassword
} from "../utils/auth.js";
import {
    config
} from "../config.js";

const PRODUCTS = [
    ["Wireless Noise-Cancelling Earbuds", "Soundwave", "electronics", 40, 0.3, 9.0, 0.02, 58, "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400"],
    ["4K Action Camera", "Vantage", "electronics", 320, 0.6, 78.0, 0.02, 64, "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400"],
    ["Bluetooth Portable Speaker", "Sony", "electronics", 130, 0.9, 32.0, 0.02, 70, "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400"],
    ["Mechanical Keyboard", "KeyForge", "electronics", 110, 1.1, 24.0, 0.018, 72, "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400"],
    ["Mirrorless Camera Body", "Vantage", "electronics", 800, 0.7, 120.0, 0.02, 66, "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400"],
    ["Down Insulated Jacket", "NorthPeak", "apparel", 180, 0.8, 28.0, 0.012, 55, "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400"],
    ["Running Shoes", "Stride", "apparel", 130, 0.6, 14.0, 0.012, 60, "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400"],
    ["Stand Mixer", "HomeChef", "home", 290, 5.0, 64.0, 0.01, 68, "https://images.unsplash.com/photo-1578643463396-0997cb5328c1?w=400"],
    ["Espresso Machine", "Crema", "home", 240, 4.2, 58.0, 0.01, 62, "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400"],
    ["Robot Vacuum", "TidyBot", "home", 350, 3.5, 70.0, 0.012, 65, "https://images.unsplash.com/photo-1603618304243-ce8c8d6e1f01?w=400"],
];

async function seed() {
    await migrate();
    const pw = await hashPassword(config.seedPassword);

    await tx(async (c) => {
        await c.query("TRUNCATE users, products RESTART IDENTITY CASCADE");

        // Catalog
        const productIds = [];
        for (const [title, brand, category, msrp, weight, carbon, dep, eco, img] of PRODUCTS) {
            const {
                rows
            } = await c.query(
                `INSERT INTO products (title, brand, category, msrp, weight_kg, embedded_carbon_kg, monthly_depreciation, eco_score, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
                [title, brand, category, msrp, weight, carbon, dep, eco, img]
            );
            productIds.push(rows[0].id);
        }

        // Users
        const mkUser = async (email, name, role, city) => {
            const {
                rows
            } = await c.query(
                `INSERT INTO users (email, password_hash, name, role, city) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
                [email, pw, name, role, city]
            );
            await c.query("INSERT INTO wallets (user_id) VALUES ($1)", [rows[0].id]);
            if (role === "seller") await c.query("INSERT INTO seller_metrics (seller_id) VALUES ($1)", [rows[0].id]);
            return rows[0];
        };
        const alex = await mkUser("alex@example.com", "Alex Rivera", "customer", "Seattle");
        const jordan = await mkUser("jordan@example.com", "Jordan Lee", "seller", "Austin");
        const dana = await mkUser("dana@example.com", "Dana Cruz", "customer", "Seattle");
        await mkUser("esg@example.com", "Enterprise ESG", "enterprise", "Seattle");
        await mkUser("admin@example.com", "Platform Admin", "admin", "Seattle");

        // Alex's purchase history (drives the return flow + dashboards)
        const history = [
            [productIds[0], 40, 0],
            [productIds[2], 130, 8],
            [productIds[1], 320, 11],
            [productIds[4], 800, 14],
            [productIds[7], 290, 9],
            [productIds[5], 180, 7],
            [productIds[3], 110, 10],
        ];
        let n = 1000;
        for (const [pid, price, age] of history) {
            const purchasedAt = new Date(Date.now() - age * 30 * 86400000);
            const {
                rows
            } = await c.query(
                `INSERT INTO orders (user_id, product_id, order_number, purchase_price, age_months, purchased_at)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
                [alex.id, pid, `ORD-${n++}`, price, age, purchasedAt]
            );
            const oid = rows[0].id;
            await c.query(`INSERT INTO product_passports (order_id, event_type, detail, actor, created_at) VALUES ($1,'manufactured',$2,'manufacturer',$3)`,
                [oid, JSON.stringify({
                    origin: "Vietnam"
                }), new Date(purchasedAt.getTime() - 45 * 86400000)]);
            await c.query(`INSERT INTO product_passports (order_id, event_type, detail, actor, created_at) VALUES ($1,'first_sale',$2,'Amazon',$3)`,
                [oid, JSON.stringify({
                    price,
                    region: "US-WA"
                }), purchasedAt]);
            await c.query(`INSERT INTO ownership_history (order_id, owner_id, owner_label, acquired_at) VALUES ($1,$2,$3,$4)`,
                [oid, alex.id, "Alex Rivera", purchasedAt]);
        }

        // Give Dana some category history so NBOE has real candidates.
        for (const [pid, price] of [
                [productIds[8], 240],
                [productIds[9], 350]
            ]) {
            await c.query(
                `INSERT INTO orders (user_id, product_id, order_number, purchase_price, age_months) VALUES ($1,$2,$3,$4,$5)`,
                [dana.id, pid, `ORD-${n++}`, price, 6]
            );
        }

        // Seller marketplace listings
        const market = [
            [productIds[8], "B", 132, "Espresso Machine — Certified Preloved (Good)"],
            [productIds[9], "A", 210, "Robot Vacuum — Certified Preloved (Excellent)"],
            [productIds[6], "A+", 78, "Running Shoes — Certified Preloved (Like New)"],
        ];
        for (const [pid, grade, price, title] of market) {
            const {
                rows
            } = await c.query(
                `INSERT INTO orders (user_id, product_id, order_number, purchase_price, age_months, status) VALUES ($1,$2,$3,$4,$5,'listed') RETURNING id`,
                [jordan.id, pid, `ORD-${n++}`, price * 1.4, 12]
            );
            await c.query(
                `INSERT INTO marketplace_listings (order_id, product_id, seller_id, marketplace, title, description, price, condition_grade, keywords, status)
         VALUES ($1,$2,$3,'certified_preloved',$4,$5,$6,$7,$8,'active')`,
                [rows[0].id, pid, jordan.id, title, "AI-inspected Certified Preloved item with Second Life Guarantee.", price, grade, JSON.stringify(["certified preloved", "sustainable"])]
            );
        }
        await c.query("UPDATE seller_metrics SET total_listings=3 WHERE seller_id=$1", [jordan.id]);
    });

    console.log("✓ seeded. Demo logins (password: " + config.seedPassword + "):");
    console.log("  customer:   alex@example.com");
    console.log("  seller:     jordan@example.com");
    console.log("  enterprise: esg@example.com");
    console.log("  admin:      admin@example.com");
    await pool.end();
}

seed().catch((e) => {
    console.error("seed failed:", e);
    process.exit(1);
});