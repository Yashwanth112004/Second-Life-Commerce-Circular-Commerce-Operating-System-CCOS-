import {
    Router
} from "express";
import {
    query,
    tx
} from "../db/pool.js";
import {
    asyncHandler
} from "../middleware/common.js";
import {
    hashPassword
} from "../utils/auth.js";
import {
    calculateCarbon
} from "../services/carbon.js";
import {
    creditsForAction
} from "../services/greenCredits.js";

const router = Router();

// POST /api/demo/seed — generate realistic demo data with inspections, donations, resales,
// passports, twins, impact metrics. Idempotent (reseeds cleanly). No auth required.
router.post(
    "/seed",
    asyncHandler(async (_req, res) => {
        // Reset
        await query("TRUNCATE users, products RESTART IDENTITY CASCADE");
        const pw = await hashPassword("Password123!");

        await tx(async (c) => {
            // --- Products ---
            const products = [
                ["Wireless Noise-Cancelling Earbuds", "Soundwave", "electronics", 40, 0.3, 9.0, 0.02, 72, "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400"],
                ["4K Action Camera", "Vantage", "electronics", 320, 0.6, 78.0, 0.02, 64, "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400"],
                ["Mirrorless Camera Body", "Vantage", "electronics", 800, 0.7, 120.0, 0.02, 66, "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400"],
                ["Bluetooth Portable Speaker", "Sony", "electronics", 130, 0.9, 32.0, 0.02, 80, "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400"],
                ["Down Insulated Jacket", "NorthPeak", "apparel", 180, 0.8, 28.0, 0.012, 55, "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400"],
                ["Stand Mixer", "HomeChef", "home", 290, 5.0, 64.0, 0.01, 78, "https://images.unsplash.com/photo-1578643463396-0997cb5328c1?w=400"],
                ["Robot Vacuum", "TidyBot", "home", 350, 3.5, 70.0, 0.012, 65, "https://images.unsplash.com/photo-1603618304243-ce8c8d6e1f01?w=400"],
                ["Running Shoes", "Stride", "apparel", 130, 0.6, 14.0, 0.012, 60, "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400"],
            ];
            const pids = [];
            for (const [t, b, cat, msrp, wt, carbon, dep, eco, img] of products) {
                const {
                    rows
                } = await c.query(
                    `INSERT INTO products (title,brand,category,msrp,weight_kg,embedded_carbon_kg,monthly_depreciation,eco_score,image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
                    [t, b, cat, msrp, wt, carbon, dep, eco, img]
                );
                pids.push(rows[0].id);
            }

            // --- Users ---
            const mkUser = async (email, name, role, city) => {
                const {
                    rows
                } = await c.query(
                    "INSERT INTO users (email,password_hash,name,role,city,ara_enabled) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
                    [email, pw, name, role, city, role === "customer"]
                );
                await c.query("INSERT INTO wallets (user_id) VALUES ($1)", [rows[0].id]);
                if (role === "seller") await c.query("INSERT INTO seller_metrics (seller_id) VALUES ($1)", [rows[0].id]);
                return rows[0];
            };
            const alex = await mkUser("alex@example.com", "Alex Rivera", "customer", "Seattle");
            const sarah = await mkUser("sarah@example.com", "Sarah Chen", "customer", "Austin");
            const jordan = await mkUser("jordan@example.com", "Jordan Lee", "seller", "Portland");
            await mkUser("esg@example.com", "Enterprise ESG", "enterprise", "Seattle");
            await mkUser("admin@example.com", "Platform Admin", "admin", "Seattle");

            // --- Orders for Alex (rich history) ---
            const alexOrders = [
                [pids[0], 40, 1], // earbuds - recent (return demo target)
                [pids[1], 320, 11], // action camera
                [pids[2], 800, 14], // mirrorless
                [pids[3], 130, 8], // speaker
                [pids[4], 180, 7], // jacket
                [pids[5], 290, 9], // mixer
                [pids[6], 350, 6], // robot vacuum
            ];
            let n = 1000;
            for (const [pid, price, age] of alexOrders) {
                const purchasedAt = new Date(Date.now() - age * 30 * 86400000);
                const {
                    rows
                } = await c.query(
                    "INSERT INTO orders (user_id,product_id,order_number,purchase_price,age_months,purchased_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
                    [alex.id, pid, `ORD-${n++}`, price, age, purchasedAt]
                );
                const oid = rows[0].id;
                await c.query("INSERT INTO product_passports (order_id,event_type,detail,actor,created_at) VALUES ($1,'manufactured',$2,'manufacturer',$3)",
                    [oid, JSON.stringify({
                        origin: "Vietnam",
                        embedded_carbon_kg: products.find(p => p[0] === pid)
                    }), new Date(purchasedAt.getTime() - 45 * 86400000)]);
                await c.query("INSERT INTO product_passports (order_id,event_type,detail,actor,created_at) VALUES ($1,'first_sale',$2,'Amazon',$3)",
                    [oid, JSON.stringify({
                        price,
                        region: "US-WA"
                    }), purchasedAt]);
                await c.query("INSERT INTO ownership_history (order_id,owner_id,owner_label,acquired_at) VALUES ($1,$2,$3,$4)",
                    [oid, alex.id, alex.name, purchasedAt]);
            }

            // --- A completed resale (speaker) — drives carbon/impact/passport demo ---
            const {
                rows: alexO
            } = await c.query("SELECT id FROM orders WHERE user_id=$1 AND product_id=$2", [alex.id, pids[3]]);
            const speakerId = alexO[0].id;
            const carbon = calculateCarbon({
                embeddedCarbonKg: 32,
                weightKg: 0.9,
                grade: "A",
                route: "zero_warehouse",
                action: "resale"
            });
            const gc = creditsForAction("resale", carbon.carbon_saved_kg);
            await c.query("INSERT INTO returns (order_id,user_id,reason_code,chosen_path,status) VALUES ($1,$2,'changed_mind','resell','completed')", [speakerId, alex.id]);
            await c.query("INSERT INTO return_assessments (return_id,order_id,grade,grade_label,confidence,reasoning,recommended_disposition,source,model,severity) VALUES ((SELECT id FROM returns WHERE order_id=$1 LIMIT 1),$1,'A','Excellent',0.94,'Pristine condition with minimal surface wear. Fully functional.','resell','vision','qwen/qwen3-vl-8b-instruct',2)", [speakerId]);
            await c.query("INSERT INTO marketplace_listings (order_id,product_id,seller_id,marketplace,title,description,price,condition_grade,status) VALUES ($1,$2,$3,'certified_preloved','Sony Bluetooth Portable Speaker — Certified Preloved (Excellent)','AI-inspected, Grade A. Minimal wear. Second Life Guarantee.',88,'A','sold')", [speakerId, pids[3], alex.id]);
            await c.query("INSERT INTO carbon_events (user_id,order_id,action,carbon_saved_kg,water_saved_l,waste_diverted_kg,manufacturing_avoided_kg) VALUES ($1,$2,'resale',$3,$4,$5,$6)",
                [alex.id, speakerId, carbon.carbon_saved_kg, carbon.water_saved_l, carbon.waste_diverted_kg, carbon.manufacturing_avoided_kg]);
            await c.query("UPDATE wallets SET green_credits=$2, carbon_saved_kg=$3, water_saved_l=$4, waste_diverted_kg=$5 WHERE user_id=$1",
                [alex.id, gc, carbon.carbon_saved_kg, carbon.water_saved_l, carbon.waste_diverted_kg]);
            await c.query("INSERT INTO green_credit_transactions (user_id,delta,reason,action,balance_after) VALUES ($1,$2,'Resold Sony Speaker','resale',$2)", [alex.id, gc]);
            await c.query("UPDATE orders SET status='sold' WHERE id=$1", [speakerId]);
            await c.query("INSERT INTO product_passports (order_id,event_type,detail,actor) VALUES ($1,'inspection',$2,'Vision AI (qwen/qwen3-vl-8b-instruct)')", [speakerId, JSON.stringify({
                grade: "A",
                confidence: 0.94
            })]);
            await c.query("INSERT INTO product_passports (order_id,event_type,detail,actor) VALUES ($1,'resale',$2,'Second Life Commerce')", [speakerId, JSON.stringify({
                price: 88,
                route: "zero_warehouse",
                carbon_saved_kg: carbon.carbon_saved_kg
            })]);
            await c.query("INSERT INTO ownership_history (order_id,owner_id,owner_label) VALUES ($1,$2,$3)", [speakerId, sarah.id, sarah.name]);
            await c.query("INSERT INTO buyer_matches (order_id,buyer_id,buyer_label,location,distance_miles,match_score,conversion_probability,predicted_days_to_sale) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                [speakerId, sarah.id, sarah.name, "South Congress, Austin", 4.2, 96, 0.92, 3]);

            // --- A completed donation (jacket) — drives donation impact demo ---
            const {
                rows: jackO
            } = await c.query("SELECT id FROM orders WHERE user_id=$1 AND product_id=$2", [alex.id, pids[4]]);
            const jacketId = jackO[0].id;
            const dCarbon = calculateCarbon({
                embeddedCarbonKg: 28,
                weightKg: 0.8,
                grade: "B",
                route: "donation_local",
                action: "donation"
            });
            const dgc = creditsForAction("donation", dCarbon.carbon_saved_kg);
            await c.query("INSERT INTO returns (order_id,user_id,reason_code,chosen_path,status) VALUES ($1,$2,'changed_mind','donate','completed')", [jacketId, alex.id]);
            await c.query("INSERT INTO donations (order_id,donor_id,ngo_name,fair_market_value,tax_receipt_id,status,impact_stage,impact_detail) VALUES ($1,$2,$3,$4,$5,'confirmed','distributed',$6)",
                [jacketId, alex.id, "Seattle Community Shelter", 78, `TR-${Date.now()}`, JSON.stringify({
                    recipient: "Seattle Community Shelter",
                    end_use: "Winter warmth for families",
                    est_people_helped: 2,
                    est_meals: 0
                })]);
            await c.query("INSERT INTO carbon_events (user_id,order_id,action,carbon_saved_kg,water_saved_l,waste_diverted_kg,manufacturing_avoided_kg) VALUES ($1,$2,'donation',$3,$4,$5,$6)",
                [alex.id, jacketId, dCarbon.carbon_saved_kg, dCarbon.water_saved_l, dCarbon.waste_diverted_kg, dCarbon.manufacturing_avoided_kg]);
            await c.query("UPDATE wallets SET green_credits=green_credits+$2, carbon_saved_kg=carbon_saved_kg+$3 WHERE user_id=$1", [alex.id, dgc, dCarbon.carbon_saved_kg]);
            await c.query("INSERT INTO green_credit_transactions (user_id,delta,reason,action,balance_after) VALUES ($1,$2,'Donated Down Jacket','donation',(SELECT green_credits FROM wallets WHERE user_id=$1))", [alex.id, dgc]);
            await c.query("UPDATE orders SET status='donated' WHERE id=$1", [jacketId]);
            await c.query("INSERT INTO product_passports (order_id,event_type,detail,actor) VALUES ($1,'donation',$2,'Second Life Commerce')", [jacketId, JSON.stringify({
                ngo: "Seattle Community Shelter",
                people_helped: 2
            })]);

            // Sarah's orders (so NBO has real category-affinity candidates)
            for (const [pid, price] of [
                    [pids[3], 130],
                    [pids[6], 350],
                    [pids[1], 320]
                ]) {
                await c.query("INSERT INTO orders (user_id,product_id,order_number,purchase_price,age_months) VALUES ($1,$2,$3,$4,$5)", [sarah.id, pid, `ORD-${n++}`, price, 5]);
            }

            // Jordan's seller listings
            for (const [pid, grade, price, title] of [
                    [pids[6], "A", 210, "Robot Vacuum — Certified Preloved (Excellent)"],
                    [pids[7], "A+", 78, "Running Shoes — Certified Preloved (Like New)"]
                ]) {
                const {
                    rows: ords
                } = await c.query("INSERT INTO orders (user_id,product_id,order_number,purchase_price,age_months,status) VALUES ($1,$2,$3,$4,$5,'listed') RETURNING id", [jordan.id, pid, `ORD-${n++}`, Math.round(price * 1.5), 10]);
                await c.query("INSERT INTO marketplace_listings (order_id,product_id,seller_id,marketplace,title,description,price,condition_grade,status) VALUES ($1,$2,$3,'certified_preloved',$4,'AI-inspected. Second Life Guarantee.',$5,$6,'active')", [ords[0].id, pid, jordan.id, title, price, grade]);
            }
            await c.query("UPDATE seller_metrics SET total_listings=2 WHERE seller_id=$1", [jordan.id]);
        });

        res.json({
            ok: true,
            message: "Demo data seeded. Log in as alex@example.com (Password123!) to explore.",
            accounts: [{
                    email: "alex@example.com",
                    role: "customer",
                    note: "Rich history: resales, donations, ARA-ready inventory, passports, carbon"
                },
                {
                    email: "sarah@example.com",
                    role: "customer",
                    note: "Buyer candidate — has category affinity for electronics/home"
                },
                {
                    email: "jordan@example.com",
                    role: "seller",
                    note: "Active marketplace listings"
                },
                {
                    email: "esg@example.com",
                    role: "enterprise"
                },
                {
                    email: "admin@example.com",
                    role: "admin"
                },
            ],
        });
    })
);

export default router;