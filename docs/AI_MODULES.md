# CCOS — AI Modules

The blueprint specifies 30 AI modules (Section 5). This documents the ones implemented in the
MVP and how every other module slots into the same `services/` pattern. Each engine exposes a
pure function (deterministic, testable) plus an optional Bedrock/Rekognition path.

## Implemented

### Module 2 — Damage Detection Vision AI (DDVA) · `services/cv_assessment.py`
- **In:** category, photo refs, item id. **Out:** grade (A+/A/B/C/D), label, confidence,
  damage notes, recommended disposition.
- **MVP:** deterministic grade from a SHA-256 seed (reproducible); category-specific damage
  vocabulary. **Prod:** Rekognition / Claude Vision via Bedrock (`_assess_with_bedrock`).

### Module 3 — Next Best Owner Engine (NBOE) · `services/next_best_owner.py`
- **In:** item, category, price, seller city. **Out:** ranked buyers (name, distance, match
  score, price fit, outreach message, predicted days-to-sale), pool size, routing decision.
- **MVP:** deterministic nearby-buyer generator (always "3 buyers near you"), zero-warehouse
  routing when nearest match ≤ 50 mi. **Prod:** two-tower retrieval + ANN over live buyer DB.

### Module 5 — Dynamic Circular Pricing Engine (DCPE) · `services/pricing.py`
- **In:** MSRP, grade, age, category. **Out:** price, floor/ceiling, markdown schedule, rationale.
- Grade retention × age depreciation × category demand. Markdown schedule feeds the ARA's
  active price management. **Prod:** RL price-optimization agent + demand elasticity model.

### Module 10 — Carbon Footprint Calculator AI (CFCA) · `services/carbon.py`
- **In:** embedded carbon, weight, grade, route, action. **Out:** kg CO₂ saved, water, waste,
  decomposition (avoided manufacturing / avoided double-shipping / circular logistics), equivalents.
- Simplified LCA: `saved = embedded × remaining_life(grade) + avoided_reorder − route_logistics`.

### Module 11 — Listing Auto-Generator (LAG) · `services/listing_generator.py`
- **In:** product, brand, grade, damage notes, price, age. **Out:** title, description,
  highlights, keywords, condition disclosure. **Prod:** Claude via Bedrock (`_generate_with_bedrock`).

### Module 30 — Autonomous Resale Agent (ARA) · `services/ara_agent.py`  ⭐
- Orchestrates DDVA + DCPE + CFCA + Green Credits across the user's whole inventory to produce a
  prioritized, autonomous resale plan with projected proceeds and impact. The headline feature.

### Green Credits economy · `services/green_credits.py`
- Action→credit bands, level progression, ledger writes. 1 GC = 1 kg CO₂e (Section 9).

## Same-pattern modules (specified, not yet in MVP)
Each is a new `services/<module>.py` with a pure function + Bedrock hook, wired into a router:

| # | Module | Engine type | Hook |
|---|--------|-------------|------|
| 1 | Return Intent Predictor (RIP) | XGBoost + LSTM | pre-purchase return risk |
| 4 | Refurbishment Decision Engine (RDE) | multi-objective optimization | disposition routing |
| 6 | Return Root Cause Analyzer (RRCA) | fine-tuned LLM classification | seller analytics |
| 7 | Product Life Predictor (PLP) | survival analysis (Weibull) | "sell now" timing |
| 8 | Smart Size Advisor (SSA) | collaborative filtering | apparel fit (#1 return cause) |
| 9 | Counterfeit & Authenticity Verifier (CAV) | contrastive CV | trust layer |
| 12 | Return Fraud Detector (RFD) | graph neural net | fraud shield |
| 13 | Repair Cost Estimator (RCE) | regression | repair-vs-scrap |
| 14 | Demand Signal Aggregator (DSA) | time-series + NLP | inventory timing |
| 16 | Sustainability Coach (SCA) | LLM + behavioral model | engagement |
| 20 | Review & Trust Synthesizer (RTS) | ensemble + Bayesian | buyer confidence |
| … | (modules 15, 17–29) | per Section 5 | — |

## Testing AI engines
All engines are pure functions and unit-testable without HTTP or a DB, e.g.:

```python
from app.services.carbon import calculate_carbon
r = calculate_carbon(embedded_carbon_kg=9.0, weight_kg=0.3, grade="A", route="zero_warehouse")
assert r.carbon_saved_kg > 0
```
