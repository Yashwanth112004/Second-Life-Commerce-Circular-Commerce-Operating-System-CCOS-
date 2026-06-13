# CCOS — Requirements

Derived from the blueprint. Status legend: ✅ implemented in MVP · 🟡 partial/stubbed · ⬜ roadmap.

## Functional requirements

### Returns & disposition intelligence
- ✅ FR-1 Customer can initiate a return on an owned item.
- ✅ FR-2 System grades item condition from photos (A+/A/B/C/D) with a confidence score (DDVA).
- ✅ FR-3 System presents an instant resale offer vs. standard refund, with net uplift.
- ✅ FR-4 System recommends the optimal disposition (resell / refurbish / donate / parts / recycle).
- 🟡 FR-5 Return Intent Predictor flags return risk pre-purchase (engine spec'd; not in MVP UI).
- ⬜ FR-6 Partial-satisfaction credit, swap request, bundle return.

### Resale & marketplace
- ✅ FR-7 GenAI generates a complete listing (title, description, highlights, keywords) (LAG).
- ✅ FR-8 Dynamic pricing recommends price + floor/ceiling + markdown schedule (DCPE).
- ✅ FR-9 Next Best Owner matches the item to ranked nearby buyers with explainable scores (NBOE).
- ✅ FR-10 Certified Preloved marketplace lists items with grade, savings %, eco score.
- 🟡 FR-11 Six marketplace channels exposed (Certified Preloved live; others modeled).
- ⬜ FR-12 Rental calendars, exchange swap-chains, parts compatibility matrix.

### Sustainability
- ✅ FR-13 Carbon engine computes verifiable CO₂/water/waste savings per transaction (CFCA).
- ✅ FR-14 Green Credits awarded per action within blueprint bands; ledger maintained.
- ✅ FR-15 Carbon Warrior level progression (Seedling → Ecosystem Guardian).
- ✅ FR-16 Impact dashboard with equivalents ("like not driving N miles").

### Product passport
- ✅ FR-17 Each item has an append-only lifecycle record (manufacture→sale→inspection→resale).
- ⬜ FR-18 Blockchain anchoring + QR/NFC retrieval.

### Autonomous Resale Agent (secret weapon)
- ✅ FR-19 ARA scans purchase history, finds latent-value items (>$30, >6mo, liquid category).
- ✅ FR-20 ARA produces a prioritized plan with price, timing, projected carbon + credits.
- ⬜ FR-21 Autonomous buyer comms, negotiation, and sale completion (orchestration is roadmap).

## Non-functional requirements
- ✅ NFR-1 Demo runs fully offline (no external API dependency at runtime).
- ✅ NFR-2 AI outputs are reproducible (seeded) for reliable live demos.
- ✅ NFR-3 Sub-2s perceived latency per AI step (artificial pacing for demo readability).
- 🟡 NFR-4 Horizontal scalability — stateless API; DB is the only state (SQLite → Aurora).
- ⬜ NFR-5 Auth/z (Cognito), rate limiting, audit logging, observability (CloudWatch/X-Ray).
- ✅ NFR-6 Graceful degradation: cloud AI failures fall back to deterministic engines.

## Key business rules
- BR-1 1 Green Credit = 1 kg CO₂e prevented; 1 GC = $0.10 redemption value.
- BR-2 GC per action is clamped to blueprint bands (resale 5–50, repair 15–100, etc.).
- BR-3 Circular transaction fee = 10% (drives `resale_net_to_seller`).
- BR-4 Resale recommended when net-to-seller > refund amount.
- BR-5 Zero-warehouse routing unlocked when a high-scoring buyer is within ~50 miles.
- BR-6 ARA candidacy: owned, ≥6 months old, purchase price ≥ $30, liquid category.

## KPIs / success metrics (from the blueprint roadmap)
- Return-to-resale conversion rate (target 35%)
- Avg days-to-sale for circular inventory (target < 15)
- Carbon saved per circular transaction (verified)
- Recovered value per returned item ($8 → $24 target)
- Landfill rate (25% → 4% target)
