import { Router } from "express";
import { z } from "zod";
import { query, tx } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, validateBody } from "../middleware/common.js";
import { scanInventory } from "../services/araAgent.js";
import { productTwin } from "../services/twin.js";
import { generateListing } from "../services/ai/listing.js";
import { findBuyers } from "../services/nextBestOwner.js";
import { logPrediction } from "../services/aiLog.js";
import { predictReturn } from "../services/returnPrediction.js";
import { evaluateRDE } from "../services/refurbishmentDecision.js";
import { PricingEngineService, recommendPrice } from "../services/pricing.js";
import { matchNGOs } from "../services/donationMatching.js";
import { calculateCarbon } from "../services/carbon.js";
import { creditsForAction, awardCredits } from "../services/greenCredits.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/status",
  asyncHandler(async (req, res) => {
    const { rows } = await query("SELECT ara_enabled FROM users WHERE id=$1", [req.user.id]);
    res.json({
      enabled: rows[0] ? rows[0].ara_enabled : false
    });
  })
);

router.post(
  "/toggle",
  validateBody(z.object({ enabled: z.boolean() })),
  asyncHandler(async (req, res) => {
    await query("UPDATE users SET ara_enabled=$2 WHERE id=$1", [req.user.id, req.body.enabled]);
    
    if (req.body.enabled) {
      req.user.ara_enabled = true;
      try {
        await runAutonomousAgentSweep(query, req.user);
      } catch (err) {
        console.error("[ARA Toggle Sweep] Immediate sweep failed:", err.message);
      }
    }

    res.json({
      enabled: req.body.enabled
    });
  })
);

router.get(
  "/suggestions",
  asyncHandler(async (req, res) => {
    const plan = await scanInventory(query, req.user);
    res.json(plan);
  })
);

// Autonomous action: the agent lists an owned item for resale (running RIP -> RDE -> DCPE -> NBOE sequentially)
router.post(
  "/list",
  validateBody(z.object({ orderId: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT o.*, p.title, p.brand, p.category, p.msrp, p.monthly_depreciation, p.size, p.embedded_carbon_kg, p.weight_kg
       FROM orders o JOIN products p ON p.id=o.product_id WHERE o.id=$1 AND o.user_id=$2`,
      [req.body.orderId, req.user.id]
    );
    const o = rows[0];
    if (!o) return res.status(404).json({ error: "Order not found" });
    if (o.status !== "owned") return res.status(409).json({ error: "Item is not available to list" });

    // Step 1: Run Return Intent Predictor (RIP)
    const rip = await predictReturn(query, {
      userId: req.user.id,
      productId: o.product_id,
      category: o.category,
      price: o.msrp * 0.6,
      brand: o.brand,
      listingQualityScore: 85,
      behavior: { timeOnPage: 60, imagesViewed: 2 },
      context: { season: "Summer", day: "Saturday", deviceType: "mobile" }
    });

    // Step 2: Run Refurbishment Decision Engine (RDE)
    const rde = await evaluateRDE(query, {
      grade: "B",
      severity: 0,
      packagingScore: 95,
      category: o.category,
      msrp: o.msrp,
      weight: o.weight_kg,
      carbonSaved: 5
    });

    // Step 3: Run Dynamic Circular Pricing Engine (DCPE)
    const priceRec = await PricingEngineService.recommend(query, {
      productId: o.product_id,
      msrp: o.msrp,
      grade: "B",
      ageMonths: o.age_months,
      category: o.category,
      region: req.user.city || "Seattle"
    });

    // Step 5 (Listing Auto-Gen): Generate Listing Description
    const product = {
      id: o.product_id,
      title: o.title,
      brand: o.brand,
      category: o.category,
      msrp: o.msrp
    };
    const gen = await generateListing({
      product,
      grade: "B",
      gradeLabel: "Good",
      damageNotes: [],
      price: priceRec.recommended_price,
      ageMonths: o.age_months,
    });
    
    await logPrediction({
      userId: req.user.id,
      module: "listing",
      input: { orderId: o.id, via: "ara" },
      output: gen.result,
      model: gen.model,
      source: gen.source,
      latencyMs: gen.latencyMs
    });

    // Step 6: Publish Listing
    const listing = await tx(async (c) => {
      const { rows: lrows } = await c.query(
        `INSERT INTO marketplace_listings 
         (order_id, product_id, seller_id, marketplace, title, description, price, condition_grade, keywords, features, status, size, expected_sale_time_days, markdown_schedule)
         VALUES ($1,$2,$3,'certified_preloved',$4,$5,$6,'B',$7,$8,'active',$9,$10,$11) RETURNING *`,
        [
          o.id, o.product_id, req.user.id, gen.result.title, gen.result.description, priceRec.recommended_price,
          JSON.stringify(gen.result.keywords), JSON.stringify(gen.result.features), o.size || "M",
          priceRec.expected_sale_time_days || 5, JSON.stringify(priceRec.markdown_schedule || [])
        ]
      );
      await c.query("UPDATE orders SET status='listed' WHERE id=$1", [o.id]);
      await c.query(
        `INSERT INTO product_passports (order_id, event_type, detail, actor) 
         VALUES ($1,'resale',$2,'Autonomous Resale Agent')`,
        [o.id, JSON.stringify({ price: priceRec.recommended_price, via: "ARA", pricing_confidence: priceRec.price_confidence })]
      );
      return lrows[0];
    });

    // Step 4: Run Next Best Owner Engine (NBOE)
    const buyers = await findBuyers(query, {
      orderId: o.id,
      listingId: listing.id,
      category: o.category,
      price: priceRec.recommended_price,
      sellerId: req.user.id,
      sellerCity: req.user.city,
    });

    for (const b of buyers.matches) {
      await query(
        `INSERT INTO buyer_matches (listing_id, order_id, buyer_id, buyer_label, location, distance_miles, match_score, conversion_probability, predicted_days_to_sale)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [listing.id, o.id, b.buyer_id, b.buyer_label, b.location, b.distance_miles, b.match_score, b.conversion_probability, b.predicted_days_to_sale]
      );
    }

    await query(
      `INSERT INTO notifications (user_id, kind, title, body) VALUES ($1,'ara','Agent listed an item',$2)`,
      [req.user.id, `${o.title} is now listed at $${priceRec.recommended_price} with ${buyers.matches.length} buyer matches.`]
    );

    res.status(201).json({
      listing: {
        ...listing,
        ...gen.result,
        ai_source: gen.source
      },
      rip,
      rde,
      pricing: priceRec,
      buyer_matches: buyers
    });
  })
);

// Active monitoring: Auto-Repricing logic
export async function autoRepriceListings(db) {
  try {
    // Find active CCOS listings with a markdown schedule that haven't sold
    const { rows: activeListings } = await db(
      `SELECT ml.*, o.purchased_at, o.user_id AS seller_id, o.id AS order_id, p.title
       FROM marketplace_listings ml
       JOIN orders o ON o.id = ml.order_id
       JOIN products p ON p.id = ml.product_id
       WHERE ml.status = 'active' AND ml.markdown_schedule IS NOT NULL AND ml.markdown_schedule <> '[]'`
    );

    for (const listing of activeListings) {
      const schedule = Array.isArray(listing.markdown_schedule) ? listing.markdown_schedule : JSON.parse(listing.markdown_schedule || "[]");
      if (schedule.length === 0) continue;

      const daysActive = Math.floor((Date.now() - new Date(listing.created_at).getTime()) / (24 * 60 * 60 * 1000));
      
      // Find the appropriate discount price based on days active
      let targetPrice = null;
      let targetDay = 0;

      // schedule is sorted by day asc (0, 7, 14, 21)
      for (const step of schedule) {
        if (daysActive >= step.day && step.day > targetDay) {
          targetPrice = Number(step.price);
          targetDay = step.day;
        }
      }

      if (targetPrice !== null && targetPrice !== Number(listing.price)) {
        console.log(`[Auto-Reprice] Markdown listing ${listing.id} from ${listing.price} to ${targetPrice} (Day ${targetDay} schedule)`);
        await db(
          `UPDATE marketplace_listings SET price = $2 WHERE id = $1`,
          [listing.id, targetPrice]
        );
        // Add Product Passport event
        await db(
          `INSERT INTO product_passports (order_id, event_type, detail, actor)
           VALUES ($1, 'ownership_transfer', $2, 'Dynamic Pricing Engine')`,
          [listing.order_id, JSON.stringify({ action: "price_markdown", old_price: listing.price, new_price: targetPrice, day: targetDay })]
        );
        // Notify seller
        await db(
          `INSERT INTO notifications (user_id, kind, title, body)
           VALUES ($1, 'ara', 'Item repriced', $2)`,
          [listing.seller_id, `Your ${listing.title} listing price was updated to $${targetPrice} according to its markdown schedule.`]
        );
      }
    }
  } catch (e) {
    console.error("[Auto-Reprice] Background repricer failed:", e.message);
  }
}

// Autonomous Resale Agent (ARA) sweep for a single user
export async function runAutonomousAgentSweep(db, user) {
  const plan = await scanInventory(db, user);
  const suggestions = plan.suggestions || [];
  
  console.log(`[ARA Sweep] Scanning user ${user.id} (${user.email}). Found ${suggestions.length} suggestions.`);
  
  for (const s of suggestions) {
    if (s.action === "hold") continue;
    
    // Check if the order is still "owned" before taking action
    const { rows: orderRows } = await db(
      `SELECT o.*, p.title, p.brand, p.category, p.msrp, p.monthly_depreciation, p.size, p.embedded_carbon_kg, p.weight_kg
       FROM orders o JOIN products p ON p.id=o.product_id WHERE o.id=$1 AND o.user_id=$2 AND o.status='owned'`,
      [s.order_id, user.id]
    );
    const o = orderRows[0];
    if (!o) continue;

    if (s.action === "sell_now") {
      console.log(`[ARA Sweep] Autonomously listing ${o.title} (Order ${o.id}) for user ${user.id}...`);
      try {
        // Run Return Intent Predictor (RIP)
        const rip = await predictReturn(db, {
          userId: user.id,
          productId: o.product_id,
          category: o.category,
          price: o.msrp * 0.6,
          brand: o.brand,
          listingQualityScore: 85,
          behavior: { timeOnPage: 60, imagesViewed: 2 },
          context: { season: "Summer", day: "Saturday", deviceType: "mobile" }
        });

        // Run Refurbishment Decision Engine (RDE)
        const rde = await evaluateRDE(db, {
          grade: "B",
          severity: 0,
          packagingScore: 95,
          category: o.category,
          msrp: o.msrp,
          weight: o.weight_kg,
          carbonSaved: 5
        });

        // Run Dynamic Circular Pricing Engine (DCPE)
        const priceRec = await PricingEngineService.recommend(db, {
          productId: o.product_id,
          msrp: o.msrp,
          grade: "B",
          ageMonths: o.age_months,
          category: o.category,
          region: user.city || "Seattle"
        });

        // Generate Listing Copy
        const product = {
          id: o.product_id,
          title: o.title,
          brand: o.brand,
          category: o.category,
          msrp: o.msrp
        };
        const gen = await generateListing({
          product,
          grade: "B",
          gradeLabel: "Good",
          damageNotes: [],
          price: priceRec.recommended_price,
          ageMonths: o.age_months,
        });

        await logPrediction({
          userId: user.id,
          module: "listing",
          input: { orderId: o.id, via: "ara_auto" },
          output: gen.result,
          model: gen.model,
          source: gen.source,
          latencyMs: gen.latencyMs
        });

        // Publish Listing
        const { rows: lrows } = await db(
          `INSERT INTO marketplace_listings 
           (order_id, product_id, seller_id, marketplace, title, description, price, condition_grade, keywords, features, status, size, expected_sale_time_days, markdown_schedule)
           VALUES ($1,$2,$3,'certified_preloved',$4,$5,$6,'B',$7,$8,'active',$9,$10,$11) RETURNING *`,
          [
            o.id, o.product_id, user.id, gen.result.title, gen.result.description, priceRec.recommended_price,
            JSON.stringify(gen.result.keywords), JSON.stringify(gen.result.features), o.size || "M",
            priceRec.expected_sale_time_days || 5, JSON.stringify(priceRec.markdown_schedule || [])
          ]
        );
        const listing = lrows[0];

        await db("UPDATE orders SET status='listed' WHERE id=$1", [o.id]);
        await db(
          `INSERT INTO product_passports (order_id, event_type, detail, actor) 
           VALUES ($1,'resale',$2,'Autonomous Resale Agent')`,
          [o.id, JSON.stringify({ price: priceRec.recommended_price, via: "ARA_AUTO", pricing_confidence: priceRec.price_confidence })]
        );

        // Next Best Owner Engine (NBOE) matches
        const buyers = await findBuyers(db, {
          orderId: o.id,
          listingId: listing.id,
          category: o.category,
          price: priceRec.recommended_price,
          sellerId: user.id,
          sellerCity: user.city,
        });

        for (const b of buyers.matches) {
          await db(
            `INSERT INTO buyer_matches (listing_id, order_id, buyer_id, buyer_label, location, distance_miles, match_score, conversion_probability, predicted_days_to_sale)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [listing.id, o.id, b.buyer_id, b.buyer_label, b.location, b.distance_miles, b.match_score, b.conversion_probability, b.predicted_days_to_sale]
          );
        }

        // Notify user of autonomous listing
        await db(
          `INSERT INTO notifications (user_id, kind, title, body) VALUES ($1,'ara','Agent listed an item',$2)`,
          [user.id, `Your ${o.title} has been autonomously listed for $${priceRec.recommended_price} with ${buyers.matches.length} buyer matches.`]
        );
      } catch (err) {
        console.error(`[ARA Sweep] Autonomously listing ${o.title} failed:`, err.message);
      }
    } else if (s.action === "donate") {
      console.log(`[ARA Sweep] Autonomously donating ${o.title} (Order ${o.id}) for user ${user.id}...`);
      try {
        const carbon = calculateCarbon({
          embeddedCarbonKg: o.embedded_carbon_kg,
          weightKg: o.weight_kg,
          grade: "B",
          route: "donation_local",
          action: "donation",
        });
        const gc = creditsForAction("donation", carbon.carbon_saved_kg);

        // Match NGOs
        const ngoMatches = await matchNGOs(db, {
          category: o.category,
          condition: "B",
          location: user.city || "Seattle",
          fmv: o.msrp * 0.6
        });
        const topNgo = ngoMatches[0];
        const ngoName = topNgo ? topNgo.name : "Red Cross Seattle";
        const ngoId = topNgo ? topNgo.ngo_id : null;

        const priceRec = recommendPrice({
          msrp: o.msrp,
          grade: "B",
          ageMonths: o.age_months,
          category: o.category
        });
        const fmv = Math.round(priceRec.recommended_price * 0.6);
        const taxBenefit = Math.round(fmv * 0.30);

        // Donation transaction
        await db(
          `INSERT INTO donations (order_id, donor_id, ngo_name, fair_market_value, tax_receipt_id, status, impact_stage, impact_detail, ngo_id, tax_benefit)
           VALUES ($1,$2,$3,$4,$5,'confirmed','received',$6,$7,$8)`,
          [o.id, user.id, ngoName, fmv, `TR-${Date.now()}`,
           JSON.stringify({
             recipient: ngoName,
             end_use: "community redistribution",
             est_meals: Math.round(fmv * 3)
           }),
           ngoId, taxBenefit
          ]
        );

        await db(
          `INSERT INTO carbon_events (user_id, order_id, action, carbon_saved_kg, water_saved_l, waste_diverted_kg, manufacturing_avoided_kg, packaging_reused, packaging_recycled, packaging_waste_avoided_kg)
           VALUES ($1,$2,'donation',$3,$4,$5,$6,$7,$8,$9)`,
          [user.id, o.id, carbon.carbon_saved_kg, carbon.water_saved_l, carbon.waste_diverted_kg, carbon.manufacturing_avoided_kg, true, false, 0.25]
        );

        await db(
          `UPDATE wallets SET carbon_saved_kg=carbon_saved_kg+$2, waste_diverted_kg=waste_diverted_kg+$3,
           packaging_reused_count=packaging_reused_count+1, packaging_waste_diverted_kg=packaging_waste_diverted_kg+0.25, updated_at=now() WHERE user_id=$1`,
          [user.id, carbon.carbon_saved_kg, carbon.waste_diverted_kg]
        );

        // Award green credits
        await awardCredits(db, {
          userId: user.id,
          delta: gc,
          reason: `Autonomously donated ${o.title} to ${ngoName}`,
          action: "donation"
        });

        await db(
          `INSERT INTO product_passports (order_id, event_type, detail, actor) VALUES ($1,'donation',$2,'Autonomous Resale Agent')`,
          [o.id, JSON.stringify({ ngo: ngoName, via: "ARA_AUTO" })]
        );

        await db("UPDATE orders SET status='donated' WHERE id=$1", [o.id]);

        await db(
          `INSERT INTO notifications (user_id, kind, title, body) VALUES ($1,'ara','Agent donated an item',$2)`,
          [user.id, `Your ${o.title} has been autonomously donated to ${ngoName} (Tax Benefit: $${taxBenefit}).`]
        );
      } catch (err) {
        console.error(`[ARA Sweep] Autonomously donating ${o.title} failed:`, err.message);
      }
    }
  }
}

// Background daemon to run autonomous sweeps for all enabled users
export async function runAllAutonomousAgents(db) {
  try {
    const { rows: users } = await db("SELECT * FROM users WHERE ara_enabled = true");
    for (const u of users) {
      await runAutonomousAgentSweep(db, u);
    }
  } catch (e) {
    console.error("[ARA Background Sweep] Failed to run all agents:", e.message);
  }
}

export default router;