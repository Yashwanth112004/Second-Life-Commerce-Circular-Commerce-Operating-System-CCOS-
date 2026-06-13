import { migrate } from "./migrate.js";
import { pool, tx } from "./pool.js";
import { hashPassword } from "../utils/auth.js";
import { config } from "../config.js";

const PRODUCTS = [
  // title, brand, category, msrp, weight, carbon, dep, eco, img, size, listing_quality
  ["Wireless Noise-Cancelling Earbuds", "Soundwave", "electronics", 40, 0.3, 9.0, 0.02, 58, "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400", "Standard", 88],
  ["4K Action Camera", "Vantage", "electronics", 320, 0.6, 78.0, 0.02, 64, "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400", "Standard", 91],
  ["Bluetooth Portable Speaker", "Sony", "electronics", 130, 0.9, 32.0, 0.02, 70, "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400", "Standard", 85],
  ["Mechanical Keyboard", "KeyForge", "electronics", 110, 1.1, 24.0, 0.018, 72, "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400", "Standard", 93],
  ["Mirrorless Camera Body", "Vantage", "electronics", 800, 0.7, 120.0, 0.02, 66, "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400", "Standard", 94],
  ["Down Insulated Jacket", "NorthPeak", "apparel", 180, 0.8, 28.0, 0.012, 55, "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400", "L", 89],
  ["Running Shoes", "Stride", "apparel", 130, 0.6, 14.0, 0.012, 60, "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400", "9", 87],
  ["Stand Mixer", "HomeChef", "home", 290, 5.0, 64.0, 0.01, 68, "https://images.unsplash.com/photo-1578643463396-0997cb5328c1?w=400", "Standard", 90],
  ["Espresso Machine", "Crema", "home", 240, 4.2, 58.0, 0.01, 62, "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400", "Standard", 86],
  ["Robot Vacuum", "TidyBot", "home", 350, 3.5, 70.0, 0.012, 65, "https://images.unsplash.com/photo-1603618304243-ce8c8d6e1f01?w=400", "Standard", 92],
];

const NGOS = [
  // name, desc, needs, capacity, city, dist, urgency, beneficiary
  ["Tech Kids Foundation", "Provides refurbished devices to children in need", ["electronics"], "open", "Seattle", 4.2, 95, "Children"],
  ["Red Cross Seattle", "Disaster relief and clothing/home distribution", ["apparel", "home"], "open", "Seattle", 3.5, 90, "Displaced Families"],
  ["Green Earth Habitat", "Eco-friendly furniture and home redistribution", ["home"], "medium", "Seattle", 2.1, 60, "Low-income Families"],
  ["Austin Community Shelter", "Provides clothing and home essentials in Austin", ["apparel", "home"], "open", "Austin", 5.0, 85, "Homeless Individuals"],
];

async function seed() {
  await migrate();
  const pw = await hashPassword(config.seedPassword);

  await tx(async (c) => {
    // Truncate all tables
    await c.query("TRUNCATE users, products, ngos, wishlists, browsing_history RESTART IDENTITY CASCADE");

    // Catalog
    const productIds = [];
    for (const [title, brand, category, msrp, weight, carbon, dep, eco, img, size, quality] of PRODUCTS) {
      const { rows } = await c.query(
        `INSERT INTO products (title, brand, category, msrp, weight_kg, embedded_carbon_kg, monthly_depreciation, eco_score, image_url, size, listing_quality_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [title, brand, category, msrp, weight, carbon, dep, eco, img, size, quality]
      );
      productIds.push(rows[0].id);
    }

    // Users
    const mkUser = async (email, name, role, city, sizePref, priceSens, sustainScore) => {
      const { rows } = await c.query(
        `INSERT INTO users (email, password_hash, name, role, city, size_preference, price_sensitivity, sustainability_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [email, pw, name, role, city, sizePref || "M", priceSens || "medium", sustainScore || 75]
      );
      await c.query("INSERT INTO wallets (user_id) VALUES ($1)", [rows[0].id]);
      if (role === "seller") await c.query("INSERT INTO seller_metrics (seller_id) VALUES ($1)", [rows[0].id]);
      return rows[0];
    };

    const alex = await mkUser("alex@example.com", "Alex Rivera", "customer", "Seattle", "L", "medium", 85);
    const jordan = await mkUser("jordan@example.com", "Jordan Lee", "seller", "Austin", "M", "low", 90);
    const dana = await mkUser("dana@example.com", "Dana Cruz", "customer", "Seattle", "9", "high", 95);
    await mkUser("esg@example.com", "Enterprise ESG", "enterprise", "Seattle", "M", "medium", 80);
    await mkUser("admin@example.com", "Platform Admin", "admin", "Seattle", "M", "medium", 80);

    // NGOs
    for (const [name, desc, needs, capacity, city, dist, urgency, beneficiary] of NGOS) {
      await c.query(
        `INSERT INTO ngos (name, description, category_needs, capacity_status, city, distance_miles, urgency_score, beneficiary_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [name, desc, JSON.stringify(needs), capacity, city, dist, urgency, beneficiary]
      );
    }

    // Wishlists & Browsing history
    // Alex wishlisted Stride Running Shoes (productIds[6]), Dana wishlisted Insulated Jacket (productIds[5])
    await c.query(`INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2)`, [alex.id, productIds[6]]);
    await c.query(`INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2)`, [dana.id, productIds[5]]);

    // Alex browsed Mirrorless Camera (productIds[4]), Dana browsed Running Shoes (productIds[6])
    await c.query(`INSERT INTO browsing_history (user_id, product_id) VALUES ($1, $2)`, [alex.id, productIds[4]]);
    await c.query(`INSERT INTO browsing_history (user_id, product_id) VALUES ($1, $2)`, [dana.id, productIds[6]]);

    // Alex's purchase history (drives return flow)
    const history = [
      [productIds[0], 40, 0], // Earbuds
      [productIds[2], 130, 8], // Speaker
      [productIds[1], 320, 11], // Camera
      [productIds[4], 800, 14], // Camera Body
      [productIds[7], 290, 9], // Mixer
      [productIds[5], 180, 7], // Jacket
      [productIds[3], 110, 10], // Keyboard
    ];
    let n = 1000;
    for (const [pid, price, age] of history) {
      const purchasedAt = new Date(Date.now() - age * 30 * 86400000);
      const { rows } = await c.query(
        `INSERT INTO orders (user_id, product_id, order_number, purchase_price, age_months, purchased_at)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [alex.id, pid, `ORD-${n++}`, price, age, purchasedAt]
      );
      const oid = rows[0].id;
      await c.query(
        `INSERT INTO product_passports (order_id, event_type, detail, actor, created_at) VALUES ($1,'manufactured',$2,'manufacturer',$3)`,
        [oid, JSON.stringify({ origin: "Vietnam" }), new Date(purchasedAt.getTime() - 45 * 86400000)]
      );
      await c.query(
        `INSERT INTO product_passports (order_id, event_type, detail, actor, created_at) VALUES ($1,'first_sale',$2,'Amazon',$3)`,
        [oid, JSON.stringify({ price, region: "US-WA" }), purchasedAt]
      );
      await c.query(
        `INSERT INTO ownership_history (order_id, owner_id, owner_label, acquired_at) VALUES ($1,$2,$3,$4)`,
        [oid, alex.id, "Alex Rivera", purchasedAt]
      );
    }

    // Dana's purchases
    for (const [pid, price] of [
      [productIds[8], 240],
      [productIds[9], 350],
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
      const { rows } = await c.query(
        `INSERT INTO orders (user_id, product_id, order_number, purchase_price, age_months, status) VALUES ($1,$2,$3,$4,$5,'listed') RETURNING id`,
        [jordan.id, pid, `ORD-${n++}`, price * 1.4, 12]
      );
      await c.query(
        `INSERT INTO marketplace_listings (order_id, product_id, seller_id, marketplace, title, description, price, condition_grade, keywords, status, size)
         VALUES ($1,$2,$3,'certified_preloved',$4,$5,$6,$7,$8,'active','9')`,
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