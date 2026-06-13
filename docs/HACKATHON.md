# CCOS — Hackathon Playbook

## The 60-minute judge experience (from the blueprint, mapped to this build)

| Minutes | Beat | Where in the app |
|---------|------|------------------|
| 0–10 | **The problem** — $816B returns, 5B lbs landfill, $28B Amazon cost | Landing page stat grid |
| 10–30 | **The AI magic (live)** — grade → resell vs refund → listing → buyers → carbon → credits | Return Wizard (`/return`) |
| 30–45 | **The platform** — marketplace, impact dashboard, product passport | `/marketplace`, `/impact` |
| 45–60 | **The business case + secret weapon** — ARA finds $1,240 of latent value | `/agent` |

## Demo script (tight version)

1. Open **Landing** — read the problem stats. "Every returned product is an unclaimed opportunity."
2. Go to **Return Wizard** → pick the **Wireless Earbuds** (the $40 item).
   - Watch the **CV grader** return a condition grade in ~1.5s.
   - Show the choice: **Refund $X** vs **Resell ~$Y (recommended)** — point at the uplift.
   - Click **Resell** → the staged reveal: listing → 3 nearby buyers → **carbon saved** → **+GC**.
3. Go to **Impact** — show the wallet, Carbon Warrior level, and the new ledger entry just created.
4. Go to **Marketplace** — show Certified Preloved listings + the six channels.
5. Finish on **Resale Agent** → click **Scan my inventory** → "I found 6 items worth $948…"
   - Land the closing line: *"Your closet is now a passive income engine."*

## What's built vs. deliberately skipped (Section 18 discipline)

| Built ✅ | Skipped (by design) |
|---------|--------------------|
| CV condition grader (deterministic) | Full blockchain DPP (relational stub instead) |
| Resell-vs-return offer | Real payments |
| GenAI listing generator | Native mobile app (web is responsive) |
| Carbon calculator + Green Credits | Rental/exchange/parts flows (modeled, not built) |
| Next Best Owner + zero-warehouse routing | Custom-trained CV model (Rekognition hook instead) |
| Impact dashboard + ledger + levels | |
| Product Passport timeline | |
| **Autonomous Resale Agent** (the differentiator) | |

## Why this wins (judge rubric)
- **Scope:** an operating system, not a feature — multi-sided, multi-marketplace, full lifecycle.
- **Technical depth:** named AI modules with real engines, explainable outputs, a Bedrock path.
- **Business clarity:** 20+ revenue streams in the blueprint; the MVP shows the transaction-fee +
  Green-Credit + ARA premium model concretely.
- **Sustainability authenticity:** carbon is computed from an LCA-style formula, not invented.
- **Unfair advantage:** zero-warehouse routing + ARA require Amazon's logistics + purchase data.
- **Timing:** EU Digital Product Passport mandate lands 2026–2027.

## Resilience tips for the live demo
- Default AI mode is `deterministic-local` — **no network needed**. Don't enable Bedrock on stage.
- Re-seed for a clean slate: `python -m app.seed` (resets GC balance and item statuses).
- The same item always yields the same grade, so you can rehearse the exact numbers.
