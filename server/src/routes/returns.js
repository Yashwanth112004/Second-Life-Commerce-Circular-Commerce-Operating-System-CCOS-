import {
    Router
} from "express";
import {
    z
} from "zod";
import {
    query,
    tx
} from "../db/pool.js";
import {
    requireAuth
} from "../middleware/auth.js";
import {
    asyncHandler,
    validateBody
} from "../middleware/common.js";
import {
    uploadEvidence,
    fileToRecord
} from "../middleware/upload.js";
import {
    inspectImages
} from "../services/ai/vision.js";
import {
    analyzeRootCause
} from "../services/ai/rootCause.js";
import {
    generateListing
} from "../services/ai/listing.js";
import {
    recommendPrice
} from "../services/pricing.js";
import {
    calculateCarbon
} from "../services/carbon.js";
import {
    creditsForAction,
    awardCredits
} from "../services/greenCredits.js";
import {
    findBuyers
} from "../services/nextBestOwner.js";
import {
    logPrediction
} from "../services/aiLog.js";
import {
    createJob,
    setStage,
    completeJob,
    getJob,
    ANALYSIS_STAGES
} from "../services/jobs.js";
import {
    assessPackaging
} from "../services/ai/packagingAssessment.js";
import {
    evaluateRDE
} from "../services/refurbishmentDecision.js";
import {
    matchNGOs
} from "../services/donationMatching.js";
import { detectReturnFraud } from "../services/ai/fraudDetector.js";

const router = Router();
router.use(requireAuth);

const COMMISSION = 0.1;

async function loadReturn(returnId, userId) {
    const {
        rows
    } = await query(
        `SELECT r.*, o.product_id, o.purchase_price, o.age_months, o.status AS order_status,
            p.title, p.brand, p.category, p.msrp, p.weight_kg, p.embedded_carbon_kg,
            p.monthly_depreciation, p.image_url, p.size
     FROM returns r
     JOIN orders o ON o.id=r.order_id
     JOIN products p ON p.id=o.product_id
     WHERE r.id=$1 AND r.user_id=$2`,
        [returnId, userId]
    );
    return rows[0];
}

// STEP 1 — initiate
router.post(
    "/initiate",
    validateBody(
        z.object({
            orderId: z.string().uuid(),
            reasonCode: z.string().default("changed_mind"),
            reasonText: z.string().optional(),
        })
    ),
    asyncHandler(async (req, res) => {
        const {
            orderId,
            reasonCode,
            reasonText
        } = req.body;
        const {
            rows: orows
        } = await query(
            `SELECT o.*, p.title, p.brand, p.category, p.msrp, p.image_url
       FROM orders o JOIN products p ON p.id=o.product_id
       WHERE o.id=$1 AND o.user_id=$2`,
            [orderId, req.user.id]
        );
        const order = orows[0];
        if (!order) return res.status(404).json({
            error: "Order not found"
        });

        const {
            rows
        } = await query(
            `INSERT INTO returns (order_id, user_id, reason_code, reason_text)
       VALUES ($1,$2,$3,$4) RETURNING *`,
            [orderId, req.user.id, reasonCode, reasonText || ""]
        );
        await query("UPDATE orders SET status='return_initiated' WHERE id=$1", [orderId]);
        res.status(201).json({
            return: rows[0],
            order
        });
    })
);

// STEP 2 — upload evidence (images / video)
router.post(
    "/:id/upload",
    uploadEvidence.array("files", 8),
    asyncHandler(async (req, res) => {
        const ret = await loadReturn(req.params.id, req.user.id);
        if (!ret) return res.status(404).json({
            error: "Return not found"
        });
        const files = req.files || [];
        const saved = [];
        const role = req.query.role || "item";
        for (const f of files) {
            const rec = fileToRecord(f);
            const {
                rows
            } = await query(
                `INSERT INTO product_images (order_id, return_id, url, kind, role) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
                [ret.order_id, ret.id, rec.url, rec.kind, role]
            );
            saved.push(rows[0]);
        }
        console.log(`[returns] uploaded ${saved.length} file(s) for return ${ret.id}:`, saved.map((s) => s.url));
        res.status(201).json({
            uploaded: saved.length,
            images: saved
        });
    })
);

// The real, staged analysis job. Vision runs on the ACTUAL uploaded images.
async function runAnalysisJob(ret, user) {
    const product = {
        id: ret.product_id,
        title: ret.title,
        brand: ret.brand,
        category: ret.category,
        msrp: ret.msrp,
    };
    try {
        // Stage: vision analysis (Qwen-VL on real image bytes)
        setStage(ret.id, "vision_analysis");
        const {
            rows: imgs
        } = await query("SELECT * FROM product_images WHERE return_id=$1", [ret.id]);
        console.log(`[analyze] return ${ret.id}: ${imgs.length} evidence file(s); invoking vision model`);
        const vision = await inspectImages({
            images: imgs,
            product
        });
        console.log(`[analyze] vision status=${vision.status} model=${vision.model} grade=${vision.result.grade} conf=${vision.result.confidence}`);

        await logPrediction({
            userId: user.id,
            module: "vision",
            input: {
                orderId: ret.order_id,
                images: imgs.length
            },
            output: vision.result,
            model: vision.model || "n/a",
            source: vision.source,
            latencyMs: vision.latencyMs || 0,
        });

        // If vision couldn't produce a confident grade, stop honestly — never fabricate damage.
        if (vision.status !== "ok") {
            completeJob(ret.id, {
                status: vision.status, // needs_more_photos | unavailable
                result: {
                    return_id: ret.id,
                    vision_status: vision.status,
                    model_used: vision.model,
                    source: vision.source,
                    assessment: vision.result,
                },
            });
            return;
        }

        setStage(ret.id, "damage_detection");
        setStage(ret.id, "condition_grading");
        const r = vision.result;

        // Run Packaging Assessment AI (PAA)
        const { rows: allImgs } = await query("SELECT * FROM product_images WHERE return_id=$1", [ret.id]);
        const pkgAssessment = await assessPackaging({ images: allImgs, userId: user.id });
        const pkg = pkgAssessment.result;

        // Stage: carbon analysis + disposition valuation
        setStage(ret.id, "carbon_analysis");
        const grade = r.grade;
        const price = recommendPrice({
            msrp: ret.msrp,
            grade,
            ageMonths: ret.age_months,
            category: ret.category,
            monthlyDepreciation: ret.monthly_depreciation,
        });
        const carbonResell = calculateCarbon({
            embeddedCarbonKg: ret.embedded_carbon_kg,
            weightKg: ret.weight_kg,
            grade,
            route: "zero_warehouse",
            action: "resale",
        });
        const carbonDonate = calculateCarbon({
            embeddedCarbonKg: ret.embedded_carbon_kg,
            weightKg: ret.weight_kg,
            grade,
            route: "donation_local",
            action: "donation",
        });

        // Run Refurbishment Decision Engine (RDE)
        const rde = await evaluateRDE(query, {
            grade: r.grade,
            severity: r.severity || 0,
            packagingScore: pkg.recyclability || 90,
            category: ret.category,
            msrp: ret.msrp,
            weight: ret.weight_kg,
            carbonSaved: carbonResell.carbon_saved_kg,
            logisticsCost: 15
        });

        const resaleNet = Math.round(price.recommended_price * (1 - COMMISSION));
        const repairCost = Math.round(ret.msrp * 0.12);
        const options = [{
                path: "refund",
                money: Number(ret.purchase_price),
                green_credits: 0,
                carbon_saved_kg: 0,
                time: "3–5 days",
                note: "Item ships back, reprocessed — often liquidated/landfilled."
            },
            {
                path: "resell",
                money: resaleNet,
                green_credits: creditsForAction("resale", carbonResell.carbon_saved_kg),
                carbon_saved_kg: carbonResell.carbon_saved_kg,
                time: "~8 days to sale",
                list_price: price.recommended_price,
                note: "AI lists, prices, and matches the next owner. No warehouse trip."
            },
            {
                path: "donate",
                money: 0,
                green_credits: creditsForAction("donation", carbonDonate.carbon_saved_kg),
                carbon_saved_kg: carbonDonate.carbon_saved_kg,
                time: "1–2 days",
                tax_receipt_value: rde.matrix.donate.tax_benefit || Math.round(price.recommended_price * 0.6),
                note: "Matched to a verified NGO; instant tax receipt."
            },
            {
                path: "exchange",
                money: 0,
                green_credits: creditsForAction("resale", Math.round(carbonResell.carbon_saved_kg * 0.8)),
                carbon_saved_kg: Math.round(carbonResell.carbon_saved_kg * 0.8 * 100) / 100,
                time: "~5 days",
                note: "Swap for a better-fit item; AI balances value."
            },
            {
                path: "repair",
                money: Math.max(0, Math.round((price.recommended_price - repairCost) * (1 - COMMISSION))),
                green_credits: creditsForAction("repair", carbonResell.carbon_saved_kg + ret.weight_kg),
                carbon_saved_kg: Math.round((carbonResell.carbon_saved_kg + ret.weight_kg) * 100) / 100,
                time: "5–10 days",
                repair_cost: repairCost,
                note: "Fix minor damage, then resell at a higher grade."
            },
        ];
        const scored = options.map((o) => ({
            ...o,
            score: o.money + o.carbon_saved_kg * 0.5 + o.green_credits * 0.1
        }));
        
        // Use RDE recommended action
        const recommended = rde.recommended;

        const assessment = await tx(async (c) => {
            const {
                rows
            } = await c.query(
                `INSERT INTO return_assessments
          (return_id, order_id, grade, grade_label, confidence, reasoning,
           recommended_disposition, packaging_condition, missing_accessories, source, model, product_type, severity,
           packaging_grade, packaging_reusable, packaging_recyclability, packaging_waste_score, packaging_recommendation, rde_decision_matrix)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
                [
                    ret.id, ret.order_id, r.grade, r.grade_label, r.confidence, r.reasoning,
                    recommended, pkg.packagingGrade || r.packaging_condition, JSON.stringify(r.missing_accessories || []),
                    vision.source, vision.model || "", r.product_type || "", r.severity || 0,
                    pkg.packagingGrade, pkg.reusable === "YES", pkg.recyclability, pkg.packagingWasteScore, pkg.recommendations, JSON.stringify(rde.matrix)
                ]
            );
            const a = rows[0];
            for (const d of r.damages || []) {
                await c.query(
                    `INSERT INTO damage_detections (assessment_id, label, severity, confidence, location)
           VALUES ($1,$2,$3,$4,$5)`,
                    [a.id, d.label, d.severity || 0, d.confidence || 0, d.location || ""]
                );
            }
            return a;
        });

        // Run Donation Matching (DIM)
        const ngoRecommendations = await matchNGOs(query, {
            category: ret.category,
            condition: r.grade,
            location: user.city || "Seattle",
            fmv: Math.round(price.recommended_price * 0.6)
        });

        // Run Return Fraud Detector (RFD) - Module 12
        const fraudResult = await detectReturnFraud(query, {
            userId: user.id,
            returnId: ret.id,
            orderId: ret.order_id,
            category: ret.category,
            price: ret.purchase_price,
            weightDiscrepancy: Number(r.severity || 0) > 4.0 || Math.random() < 0.05,
            accountAgeDays: 90
        });

        // Stage: buyer matching preview (real DB candidates)
        setStage(ret.id, "buyer_matching");
        const buyerPreview = await findBuyers(query, {
            orderId: ret.order_id,
            category: ret.category,
            price: price.recommended_price,
            sellerId: user.id,
            sellerCity: user.city,
        });

        // Stage: report generation (Nemotron text)
        setStage(ret.id, "report_generation");
        const rc = await analyzeRootCause({
            product,
            reasonCode: ret.reason_code,
            reasonText: ret.reason_text
        });
        await logPrediction({
            userId: user.id,
            module: "root_cause",
            input: {
                reason: ret.reason_code
            },
            output: rc.result,
            model: rc.model,
            source: rc.source,
            latencyMs: rc.latencyMs,
        });

        await query("UPDATE returns SET status='analyzed' WHERE id=$1", [ret.id]);

        completeJob(ret.id, {
            status: "completed",
            result: {
                return_id: ret.id,
                vision_status: "ok",
                model_used: vision.model,
                source: vision.source,
                images: allImgs.map((i) => ({
                    url: i.url,
                    kind: i.kind,
                    role: i.role
                })),
                assessment: {
                    ...r,
                    id: assessment.id,
                    source: vision.source,
                    model: vision.model,
                    packaging_grade: pkg.packagingGrade,
                    packaging_reusable: pkg.reusable,
                    packaging_recyclability: pkg.recyclability,
                    packaging_waste_score: pkg.packagingWasteScore,
                    packaging_recommendation: pkg.recommendations,
                    packaging_reasoning: pkg.reasoning
                },
                root_cause: {
                    ...rc.result,
                    source: rc.source,
                    model: rc.model
                },
                pricing: price,
                options: scored,
                recommended,
                rde,
                packaging: pkg,
                ngo_recommendations: ngoRecommendations,
                buyer_preview: buyerPreview,
                fraud_detection: fraudResult,
            },
        });
    } catch (e) {
        console.error(`[analyze] job ${ret.id} failed:`, e.message);
        completeJob(ret.id, {
            status: "failed",
            error: e.message
        });
    }
}

// STEP 3 — kick off analysis (returns immediately; poll status)
router.post(
    "/:id/analyze",
    asyncHandler(async (req, res) => {
        const ret = await loadReturn(req.params.id, req.user.id);
        if (!ret) return res.status(404).json({
            error: "Return not found"
        });
        createJob(ret.id);
        // Fire-and-forget; progress is tracked via the job store.
        runAnalysisJob(ret, req.user);
        res.status(202).json({
            jobId: ret.id,
            status: "running",
            stages: ANALYSIS_STAGES
        });
    })
);

// Poll real analysis progress / result
router.get(
    "/:id/analyze/status",
    asyncHandler(async (req, res) => {
        const ret = await loadReturn(req.params.id, req.user.id);
        if (!ret) return res.status(404).json({
            error: "Return not found"
        });
        const job = getJob(ret.id);
        if (!job) return res.status(404).json({
            error: "No analysis job found. Start one with POST /analyze."
        });
        res.json({
            jobId: ret.id,
            status: job.status,
            stage: job.stage,
            stages: ANALYSIS_STAGES,
            stages_done: job.stagesDone,
            result: job.result,
            error: job.error,
        });
    })
);

// STEP 7 — commit decision
router.post(
    "/:id/decision",
    validateBody(
        z.object({
            path: z.enum(["refund", "resell", "donate", "exchange", "repair", "keep"]),
            route: z.string().default("zero_warehouse"),
            ngoName: z.string().optional(),
        })
    ),
    asyncHandler(async (req, res) => {
        const ret = await loadReturn(req.params.id, req.user.id);
        if (!ret) return res.status(404).json({
            error: "Return not found"
        });
        const {
            path: choice,
            route,
            ngoName
        } = req.body;

        const {
            rows: arows
        } = await query(
            "SELECT * FROM return_assessments WHERE return_id=$1 ORDER BY created_at DESC LIMIT 1",
            [ret.id]
        );
        const assessment = arows[0];
        // Resell/repair/exchange require a real graded inspection.
        if (!assessment && (choice === "resell" || choice === "repair" || choice === "exchange")) {
            return res.status(409).json({
                error: "Run image analysis first — no condition grade on file for this return."
            });
        }
        const grade = (assessment && assessment.grade) || "A";
        const gradeLabel = (assessment && assessment.grade_label) || "Excellent";

        const product = {
            id: ret.product_id,
            title: ret.title,
            brand: ret.brand,
            category: ret.category,
            msrp: ret.msrp,
        };
        const price = recommendPrice({
            msrp: ret.msrp,
            grade,
            ageMonths: ret.age_months,
            category: ret.category,
            monthlyDepreciation: ret.monthly_depreciation,
        });
        const response = {
            path: choice
        };

        if (choice === "resell") {
            const gen = await generateListing({
                product,
                grade,
                gradeLabel,
                damageNotes: [],
                price: price.recommended_price,
                ageMonths: ret.age_months,
            });
            await logPrediction({
                userId: req.user.id,
                module: "listing",
                input: {
                    orderId: ret.order_id
                },
                output: gen.result,
                model: gen.model,
                source: gen.source,
                latencyMs: gen.latencyMs,
            });
            const carbon = calculateCarbon({
                embeddedCarbonKg: ret.embedded_carbon_kg,
                weightKg: ret.weight_kg,
                grade,
                route,
                action: "resale",
            });
            const gc = creditsForAction("resale", carbon.carbon_saved_kg);

            // Packaging assessment circularity tracking
            const packagingGrade = assessment ? assessment.packaging_grade : 'A';
            const packagingReusable = assessment ? (assessment.packaging_reusable === true || assessment.packaging_reusable === 'YES') : true;
            const packagingRecyclability = assessment ? Number(assessment.packaging_recyclability) : 96.00;
            const packagingWasteScore = assessment ? Number(assessment.packaging_waste_score) : 4.00;

            const isReused = packagingReusable ? 1 : 0;
            const isRecycled = !packagingReusable && packagingRecyclability > 50 ? 1 : 0;
            const packagingWasteAvoided = isReused ? 0.25 : (isRecycled ? 0.15 : 0.0);

            const out = await tx(async (c) => {
                const {
                    rows: lrows
                } = await c.query(
                    `INSERT INTO marketplace_listings
            (order_id, product_id, seller_id, marketplace, title, description, price,
             condition_grade, keywords, features, status, size)
           VALUES ($1,$2,$3,'certified_preloved',$4,$5,$6,$7,$8,$9,'active',$10) RETURNING *`,
                    [ret.order_id, ret.product_id, req.user.id, gen.result.title, gen.result.description,
                        price.recommended_price, grade, JSON.stringify(gen.result.keywords), JSON.stringify(gen.result.features), ret.size || "M"
                    ]
                );
                const listing = lrows[0];
                await c.query(
                    `INSERT INTO carbon_events (user_id, order_id, action, carbon_saved_kg, water_saved_l, waste_diverted_kg, manufacturing_avoided_kg, packaging_reused, packaging_recycled, packaging_waste_avoided_kg)
           VALUES ($1,$2,'resale',$3,$4,$5,$6,$7,$8,$9)`,
                    [req.user.id, ret.order_id, carbon.carbon_saved_kg, carbon.water_saved_l, carbon.waste_diverted_kg, carbon.manufacturing_avoided_kg, packagingReusable, !packagingReusable && packagingRecyclability > 50, packagingWasteAvoided]
                );
                await c.query(
                    `UPDATE wallets SET carbon_saved_kg=carbon_saved_kg+$2, water_saved_l=water_saved_l+$3,
             waste_diverted_kg=waste_diverted_kg+$4, packaging_reused_count=packaging_reused_count+$5, packaging_recycled_count=packaging_recycled_count+$6, packaging_waste_diverted_kg=packaging_waste_diverted_kg+$7, updated_at=now() WHERE user_id=$1`,
                    [req.user.id, carbon.carbon_saved_kg, carbon.water_saved_l, carbon.waste_diverted_kg, isReused, isRecycled, packagingWasteAvoided]
                );
                const credit = await awardCredits(c, {
                    userId: req.user.id,
                    delta: gc,
                    reason: `Resold ${ret.title} instead of returning`,
                    action: "resale"
                });
                await c.query(
                    `INSERT INTO product_passports (order_id, event_type, detail, actor) VALUES
            ($1,'inspection',$2,'Vision AI'),
            ($1,'resale',$3,'Second Life Commerce')`,
                    [ret.order_id, JSON.stringify({
                            grade,
                            model: assessment ? assessment.model : ""
                        }),
                        JSON.stringify({
                            price: price.recommended_price,
                            route,
                            carbon_saved_kg: carbon.carbon_saved_kg
                        })
                    ]
                );
                await c.query("UPDATE orders SET status='listed' WHERE id=$1", [ret.order_id]);
                await c.query("UPDATE returns SET chosen_path='resell', status='completed' WHERE id=$1", [ret.id]);
                return {
                    listing,
                    credit
                };
            });
            const buyers = await findBuyers(query, {
                orderId: ret.order_id,
                listingId: out.listing.id,
                category: ret.category,
                price: price.recommended_price,
                sellerId: req.user.id,
                sellerCity: req.user.city,
            });
            for (const b of buyers.matches) {
                await query(
                    `INSERT INTO buyer_matches (listing_id, order_id, buyer_id, buyer_label, location, distance_miles, match_score, conversion_probability, predicted_days_to_sale)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                    [out.listing.id, ret.order_id, b.buyer_id, b.buyer_label, b.location, b.distance_miles, b.match_score, b.conversion_probability, b.predicted_days_to_sale]
                );
            }
            Object.assign(response, {
                listing: {
                    ...out.listing,
                    ...gen.result,
                    ai_source: gen.source
                },
                carbon,
                green_credits_earned: gc,
                new_gc_balance: out.credit.balance,
                buyer_matches: buyers,
            });
        } else if (choice === "donate") {
            const carbon = calculateCarbon({
                embeddedCarbonKg: ret.embedded_carbon_kg,
                weightKg: ret.weight_kg,
                grade,
                route: "donation_local",
                action: "donation",
            });
            const gc = creditsForAction("donation", carbon.carbon_saved_kg);

            // Packaging assessment circularity tracking
            const packagingGrade = assessment ? assessment.packaging_grade : 'A';
            const packagingReusable = assessment ? (assessment.packaging_reusable === true || assessment.packaging_reusable === 'YES') : true;
            const packagingRecyclability = assessment ? Number(assessment.packaging_recyclability) : 96.00;
            const packagingWasteScore = assessment ? Number(assessment.packaging_waste_score) : 4.00;

            const isReused = packagingReusable ? 1 : 0;
            const isRecycled = !packagingReusable && packagingRecyclability > 50 ? 1 : 0;
            const packagingWasteAvoided = isReused ? 0.25 : (isRecycled ? 0.15 : 0.0);

            const out = await tx(async (c) => {
                // Look up matching NGO
                const { rows: ngoRows } = await c.query(
                    `SELECT id, beneficiary_type FROM ngos WHERE name = $1 LIMIT 1`,
                    [ngoName || "Red Cross Seattle"]
                );
                const ngoId = ngoRows[0] ? ngoRows[0].id : null;
                const fmv = Math.round(price.recommended_price * 0.6);
                const taxBenefit = Math.round(fmv * 0.30);

                const {
                    rows
                } = await c.query(
                    `INSERT INTO donations (order_id, donor_id, ngo_name, fair_market_value, tax_receipt_id, status, impact_stage, impact_detail, ngo_id, tax_benefit)
           VALUES ($1,$2,$3,$4,$5,'confirmed','received',$6,$7,$8) RETURNING *`,
                    [ret.order_id, req.user.id, ngoName || "Red Cross Seattle", fmv, `TR-${Date.now()}`,
                        JSON.stringify({
                            recipient: ngoName || "Red Cross Seattle",
                            end_use: "community redistribution",
                            est_meals: Math.round(fmv * 3)
                        }),
                        ngoId, taxBenefit
                    ]
                );
                await c.query(
                    `INSERT INTO carbon_events (user_id, order_id, action, carbon_saved_kg, water_saved_l, waste_diverted_kg, manufacturing_avoided_kg, packaging_reused, packaging_recycled, packaging_waste_avoided_kg)
           VALUES ($1,$2,'donation',$3,$4,$5,$6,$7,$8,$9)`,
                    [req.user.id, ret.order_id, carbon.carbon_saved_kg, carbon.water_saved_l, carbon.waste_diverted_kg, carbon.manufacturing_avoided_kg, packagingReusable, !packagingReusable && packagingRecyclability > 50, packagingWasteAvoided]
                );
                await c.query(
                    `UPDATE wallets SET carbon_saved_kg=carbon_saved_kg+$2, waste_diverted_kg=waste_diverted_kg+$3,
             packaging_reused_count=packaging_reused_count+$4, packaging_recycled_count=packaging_recycled_count+$5, packaging_waste_diverted_kg=packaging_waste_diverted_kg+$6, updated_at=now() WHERE user_id=$1`,
                    [req.user.id, carbon.carbon_saved_kg, carbon.waste_diverted_kg, isReused, isRecycled, packagingWasteAvoided]
                );
                const credit = await awardCredits(c, {
                    userId: req.user.id,
                    delta: gc,
                    reason: `Donated ${ret.title}`,
                    action: "donation"
                });
                await c.query(`INSERT INTO product_passports (order_id, event_type, detail, actor) VALUES ($1,'donation',$2,'Second Life Commerce')`,
                    [ret.order_id, JSON.stringify({
                        ngo: ngoName || "Red Cross Seattle"
                    })]);
                await c.query("UPDATE orders SET status='donated' WHERE id=$1", [ret.order_id]);
                await c.query("UPDATE returns SET chosen_path='donate', status='completed' WHERE id=$1", [ret.id]);
                return {
                    donation: rows[0],
                    credit
                };
            });
            Object.assign(response, {
                donation: out.donation,
                carbon,
                green_credits_earned: gc,
                new_gc_balance: out.credit.balance
            });
        } else if (choice === "refund") {
            await tx(async (c) => {
                await c.query("UPDATE returns SET chosen_path='refund', refund_amount=$2, status='completed' WHERE id=$1", [ret.id, ret.purchase_price]);
                await c.query("UPDATE orders SET status='sold' WHERE id=$1", [ret.order_id]);
            });
            Object.assign(response, {
                refund_amount: Number(ret.purchase_price)
            });
        } else {
            await query("UPDATE returns SET chosen_path=$2, status='completed' WHERE id=$1", [ret.id, choice]);
            Object.assign(response, {
                recorded: true
            });
        }

        await query(
            `INSERT INTO notifications (user_id, kind, title, body) VALUES ($1,'return',$2,$3)`,
            [req.user.id, `Return resolved: ${choice}`, `Your ${ret.title} return was completed via ${choice}.`]
        );
        res.json(response);
    })
);

export default router;