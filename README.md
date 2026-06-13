# Second Life Commerce — Circular Commerce Operating System (CCOS)

> **A production-grade AI-powered circular economy platform** — returns intelligence, computer vision condition grading, autonomous resale, donation matching, verifiable carbon accounting, Green Credits DeFi economy, and Digital Product Passports — built on a real PostgreSQL database, JWT auth, and live AI inference via OpenRouter.

---

## Table of Contents

1. [Architecture & Stack](#architecture--stack)
2. [Quick Start](#quick-start)
3. [Demo Accounts](#demo-accounts)
4. [Feature Overview](#feature-overview)
5. [AI Modules (25 Engines)](#ai-modules)
6. [API Reference](#api-reference)
7. [User Journeys](#user-journeys)
8. [Security](#security)

---

## Architecture & Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite + Vanilla CSS + Framer Motion + TanStack Query + Recharts |
| **Backend** | Node.js 20 + Express 4 (ESM) |
| **Database** | PostgreSQL 16 via Docker (port 5433) |
| **Auth** | JWT access tokens + refresh-token rotation, bcrypt, role-based access control |
| **AI — Vision** | `qwen/qwen3-vl-8b-instruct` via OpenRouter (damage detection, condition grading, packaging assessment) |
| **AI — Text** | `nvidia/nemotron-super-120b-instruct` via OpenRouter (listing generation, root-cause, coach, refurbishment instructions, fraud detection) |
| **Storage** | Local disk (`/uploads`) with Cloudinary integration point |
| **Infrastructure** | Docker Compose (PostgreSQL + Express API + Adminer) |

```
second-life-commerce/
├── server/
│   └── src/
│       ├── routes/        # 18 API route modules
│       ├── services/      # 14 core + 10 AI service modules
│       │   └── ai/        # Vision, listing, pricing, fraud, packaging, sizing…
│       └── db/            # Schema, migrations, seed data
├── frontend/
│   └── src/
│       ├── pages/         # 10 pages (Dashboard, Marketplace, ReturnWizard, Wallet, Agent…)
│       └── Concierge.jsx  # Persistent AI concierge bar
└── docker-compose.yml
```

---

## Quick Start

### 1. Database (Docker)
```bash
docker compose up -d db        # PostgreSQL on host port 5433
```

### 2. Backend API
```bash
cd server
cp .env.example .env           # Set OPENROUTER_API_KEY for live AI; fallback mode works without it
npm install
npm run seed                   # Migrate schema + seed demo users, products, orders, listings
npm run dev                    # http://localhost:4000  (hot-reload via --watch)
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

### Or everything in Docker
```bash
docker compose up --build      # db + api + adminer (port 8080)
docker compose exec api npm run seed
```

> **AI mode** is shown at `GET /api/health`. Without a key the system runs in transparent `fallback` mode using deterministic formulas — the app is fully functional. Set `OPENROUTER_API_KEY` to enable live vision/text model calls.

---

## Demo Accounts

All accounts use password: **`Password123!`**

| Role | Email | Dashboard Access |
|------|-------|-----------------|
| **Customer** | `alex@example.com` | Return Wizard, Wallet, Circular Command Center, Resale Agent, DeFi |
| **Seller** | `jordan@example.com` | Seller Dashboard (listings, revenue, AI root-cause analysis) |
| **Enterprise** | `esg@example.com` | ESG / Circular GMV / Packaging Circularity Dashboard |
| **Admin** | `admin@example.com` | Platform Analytics, AI Prediction Logs, Return Fraud Cases |

---

## Feature Overview

### ✅ All 15+ Features Verified Working

| # | Feature | Status | Endpoint / UI |
|---|---------|--------|--------------|
| 1 | Smart Return Wizard (5-step) | ✅ | `/return` |
| 2 | AI Vision Condition Grading | ✅ | `POST /api/returns/:id/analyze` |
| 3 | Autonomous Resale Agent (ARA) | ✅ | `/agent` · `POST /api/ara/toggle` |
| 4 | Circular Concierge (AI bar) | ✅ | Persistent header bar |
| 5 | Marketplace (6 channels) | ✅ | `/marketplace` |
| 6 | Purchase → Return Flow | ✅ | `POST /api/marketplace/buy/:id` |
| 7 | Return Intent Predictor (RIP) | ✅ | `POST /api/marketplace/listing/:id/predict-return` |
| 8 | Next Best Owner Engine (NBOE) | ✅ | Auto-runs in ARA sweep |
| 9 | Refurbishment Decision Engine (RDE) | ✅ | Auto-runs in return analysis |
| 10 | Dynamic Circular Pricing (DCPE) | ✅ | Auto-runs in ARA list flow |
| 11 | Listing Auto-Generator (LAG) | ✅ | Auto-runs in ARA list flow |
| 12 | Packaging Assessment AI (PAA) | ✅ | Step 3 of Return Wizard |
| 13 | Donation Impact Maximizer (DIM) | ✅ | `POST /api/returns/:id/decision` path=donate |
| 14 | Return Fraud Detector (RFD) | ✅ | Auto-runs during return analysis |
| 15 | Smart Size Advisor (SSA) | ✅ | `GET /api/marketplace/listing/:id/size-advice` |
| 16 | Real-Time Refurbishment Instructions (RRIG) | ✅ | `GET /api/inspection/:id/refurbish-instructions` |
| 17 | Predictive End-of-Life Notifications | ✅ | In ARA suggestions + Concierge |
| 18 | Green Credit DeFi Token Swap | ✅ | `/wallet` · `POST /api/wallet/trade-credits` |
| 19 | Digital Product Passport | ✅ | `/passport/:orderId` |
| 20 | Carbon Accounting Engine | ✅ | `GET /api/carbon/report` |
| 21 | Circular Score + Leaderboard | ✅ | `GET /api/circular/score` |
| 22 | AI Sustainability Coach | ✅ | `POST /api/ai/sustainability-coach` |
| 23 | Auto-Repricing (markdown schedule) | ✅ | Background daemon, 15-min interval |
| 24 | Enterprise ESG Dashboard | ✅ | `/dashboard` (enterprise/admin role) |
| 25 | Admin Analytics + AI Logs | ✅ | `/dashboard` (admin role) |

---

## AI Modules

### Module 1 — Return Intent Predictor (RIP)
**Purpose:** Predict likelihood of return before a purchase is confirmed.

**How it works:**
- Compiles buyer's return history (rate, frequency, category concentration)
- Factors in real-time session behavior (time on page, images viewed, comparison behavior)
- Produces a risk probability score and classifies as `LOW`, `MEDIUM`, or `HIGH`
- Shown as a color-coded gauge in the marketplace checkout modal

**Endpoint:** `POST /api/marketplace/listing/:id/predict-return`
```json
{ "behavior": { "timeOnPage": 120, "imagesViewed": 3 }, "context": { "season": "Summer" } }
```
**Response:** `{ "return_probability": 0.22, "risk_level": "LOW", "factors": [...] }`

**Service:** `server/src/services/returnPrediction.js`

---

### Module 2 — AI Vision Condition Grading
**Purpose:** Assess physical condition of returned items using computer vision.

**How it works:**
- Uploaded photos are sent as base64 to `qwen/qwen3-vl-8b-instruct` via OpenRouter
- Model identifies damage type, location, severity, and assigns an ISO-style grade (A+ → F)
- Output includes confidence score, damage detections list, and a plain-English grade label
- Falls back to deterministic formula grading if vision is unavailable
- If evidence is insufficient, returns `needs_more_photos` — never fabricates a damage report

**Grades:**
| Grade | Label | Retention |
|-------|-------|----------|
| A+ | Like New | 82% MSRP |
| A | Excellent | 72% MSRP |
| B | Good | 58% MSRP |
| C | Fair | 40% MSRP |
| D | Poor | 20% MSRP |
| F | For Parts | 5% MSRP |

**Endpoint:** `POST /api/returns/:id/analyze` (starts async job)
**Service:** `server/src/services/ai/vision.js`

---

### Module 3 — Next Best Owner Engine (NBOE)
**Purpose:** Match every resale listing to the highest-propensity buyers.

**How it works:**
- Scores all platform users against the item using: category affinity, purchase history, browsing history, wishlist matches, location proximity (haversine distance), size fit (apparel), price sensitivity, and sustainability score
- Returns top 10 matches with purchase probability %, predicted sale time, and outreach copy
- Stores matches in `buyer_matches` table for the seller to view in the passport

**Used by:** ARA sweep (auto), `/ara/list` route, Return Wizard resell path

**Service:** `server/src/services/nextBestOwner.js`

---

### Module 4 — Refurbishment Decision Engine (RDE)
**Purpose:** Decide whether to resell as-is, refurbish then resell, donate, or recycle.

**How it works:**
- Evaluates a 4-route decision matrix with projected profit, carbon savings, and circular impact score for each path
- Inputs: condition grade, damage severity, packaging score, category, MSRP, weight
- Output: ranked recommendation with ROI and carbon impact per route

**Endpoint:** Part of `POST /api/returns/:id/analyze` → result includes `rde_recommendation`
**Service:** `server/src/services/refurbishmentDecision.js`

---

### Module 5 — Dynamic Circular Pricing Engine (DCPE)
**Purpose:** Set optimal resale price using circular economy signals.

**How it works:**
- Inputs: condition grade, age (months), category demand index, brand value, regional market trends
- Formula: `price = MSRP × grade_retention × age_factor × demand_multiplier × brand_factor × trend_factor`
- Generates markdown schedule (Day 0, 7, 14, 21), price floor/ceiling, and expected sale time
- AI-enhanced variant calls Nemotron text model for richer market context

**Grade Retention:** A+ = 82%, A = 72%, B = 58%, C = 40%, D = 20%
**Category Demand Multiplier:** Electronics ×1.08, Apparel ×1.02, Home ×0.98

**Service:** `server/src/services/pricing.js`

---

### Module 6 — Listing Auto-Generator (LAG)
**Purpose:** Generate SEO-optimized product listings in seconds.

**How it works:**
- Inputs: product specs, condition grade, damage notes, AI pricing recommendation, age
- Calls Nemotron text model (fine-tuned GPT-class) with a RAG-style prompt over product catalog
- Generates: title, description (brand voice), key highlights, condition disclosure, SEO keywords, features list
- Falls back to deterministic template if AI is unavailable

**Endpoint:** Called automatically by `POST /api/ara/list`
**Service:** `server/src/services/ai/listing.js`

---

### Module 7 — Packaging Assessment AI (PAA)
**Purpose:** Assess returned product packaging for reusability and recyclability.

**How it works:**
- Upload packaging photos (front, back, inside, barcode scan) in Return Wizard Step 3
- Vision model identifies packaging material type, damage extent, and structural integrity
- Outputs: reusability score (0–100), recycling stream classification (cardboard/plastic/composite), repackaging recommendation, packaging waste score
- Results feed into RDE to adjust disposition decisions
- Carbon savings from packaging reuse tracked in `carbon_events` and wallet metrics

**How to use:** In the Return Wizard, after uploading item photos (Step 2), upload packaging photos in Step 3

**Service:** `server/src/services/ai/packagingAssessment.js`

---

### Module 8 — Donation Impact Maximizer (DIM)
**Purpose:** Match donated items to the highest-impact verified NGOs.

**How it works:**
- Scores NGO candidates from the `ngos` table by: category match, capacity status, distance, urgency score, and beneficiary type
- Calculates fair market value (FMV) using DCPE and applies 30% tax benefit calculation
- Generates tax receipt ID (format `TR-{timestamp}`) and impact detail (people served, end use)
- Tracked in `donations` table with lifecycle stages: received → verified → distributed → in_use

**Endpoint:** `POST /api/returns/:id/decision` with `{ "path": "donate", "ngoName": "..." }`
**Service:** `server/src/services/donationMatching.js`

---

### Module 9 — Return Fraud Detector (RFD)
**Purpose:** Detect and prevent return fraud in real time.

**How it works:**
- Analyses return pattern history: return frequency, timing regularity, category concentration, account age
- Computes an anomaly rate by comparing user's returns to baseline platform averages
- Classifies fraud type: empty box, wardrobing (use-and-return), switch fraud, or serial returner
- Fraud probability score triggers an alert record in `fraud_cases` table
- Admin dashboard shows open fraud cases for review

**Triggered by:** Automatically during `POST /api/returns/:id/analyze` pipeline
**Service:** `server/src/services/ai/fraudDetector.js`

---

### Module 10 — Smart Size Advisor (SSA)
**Purpose:** Reduce size-related returns with AI fitting recommendations.

**How it works:**
- Retrieves buyer's `size_preference` from their profile and compares to product size and brand sizing patterns
- For apparel: cross-references wishlist history and past purchases in same brand/category
- Returns: recommended size, size chart note, confidence score, and fit guidance
- Shown as a card in the marketplace checkout pre-buy review modal

**Endpoint:** `GET /api/marketplace/listing/:id/size-advice?fitPreference=regular`
```json
{ "recommended_size": "L", "confidence": 0.88, "fit_note": "Runs slightly small — size up recommended" }
```
**Service:** `server/src/services/ai/sizeAdvisor.js`

---

### Module 11 — Real-Time Refurbishment Instructions (RRIG)
**Purpose:** Generate step-by-step refurbishment instructions for warehouse operators.

**How it works:**
- Inputs: damage assessment from vision AI, product specs, available tool inventory, operator skill level (beginner/intermediate/expert)
- Calls Nemotron text model with RAG over a repair knowledge base
- Outputs: illustrated step-by-step guide, parts list, estimated time, quality check criteria, safety warnings
- Skill-level tailoring: beginners get simpler steps and more safety notes; experts get advanced techniques

**Endpoint:** `GET /api/inspection/:returnId/refurbish-instructions?skillLevel=intermediate&tools=screwdriver,heatgun`
**Service:** `server/src/services/ai/refurbishInstructions.js`

---

### Module 12 — AI Sustainability Coach
**Purpose:** Proactively coach users on circular economy actions.

**How it works:**
- Analyzes user's circular score breakdown, owned inventory age, carbon savings, and Green Credits balance
- Generates personalized tips using Nemotron text model (or formula fallback)
- Returns 3–5 ranked recommendations with impact projections (GC earned, CO₂ saved)

**Endpoint:** `POST /api/ai/sustainability-coach`
**Service:** `server/src/services/ai/sustainabilityCoach.js`

---

### Module 13 — Autonomous Resale Agent (ARA)
**Purpose:** Autonomously list, price, and donate items without manual effort.

**How it works:**
1. User enables the agent via the toggle on `/agent` page
2. On toggle, the agent immediately runs a sweep of all owned inventory
3. For each owned item, the agent runs the full pipeline: **RIP → RDE → DCPE → LAG → NBOE**
4. Items with `sell_now` action get autonomously listed on the marketplace
5. Items with `donate` action (low value or low probability) are autonomously donated to the best-matched NGO
6. A background daemon (`runAllAutonomousAgents`) re-sweeps all enabled users every **15 minutes**
7. Auto-repricing daemon (`autoRepriceListings`) applies markdown schedule every **15 minutes**
8. All agent actions are logged as notifications (`kind: 'ara'`) visible in the Agent Activity Feed

**Verification (live):**
```
Stats — Listings generated: 9 | Buyer matches found: 90 | ARA-listed items: 9
```

**Endpoints:** `GET /api/ara/status`, `POST /api/ara/toggle`, `GET /api/ara/suggestions`, `POST /api/ara/list`
**Service:** `server/src/services/araAgent.js` · `server/src/routes/ara.js`

---

### Module 14 — Circular Concierge (AI Bar)
**Purpose:** Proactive AI assistant visible on every page for logged-in users.

**How it works:**
- Persistent sticky bar below the navigation header (refetched every 60 seconds)
- Synthesizes ARA inventory scan + Product Twin forecasts + CES scores into ranked recommendations
- Shows value recovery potential ($), carbon opportunity (kg CO₂), Green Credits opportunity, and circular score delta
- Expandable: clicking shows full recommendation cards with "Why?" explainability and "List it" one-click actions
- ⚠️ **EOL Alert** pulsing badges appear for items approaching near-zero value

**Endpoint:** `GET /api/concierge`

---

### Module 15 — Predictive End-of-Life (EOL) Notifications
**Purpose:** Alert users when items are approaching near-zero resale value.

**How it works:**
- During every ARA inventory scan, the Digital Product Twin projects value at M+3 months
- If `forecast.m3 < $60` AND `monthly_decay_pct ≥ 1%`, the item is flagged `is_eol: true`
- The concierge service auto-creates a database notification (`kind: 'eol'`) with deduplication
- Message format: *"Your item will reach near-zero resale value in ~3 months. List now for $X."*
- EOL alerts surface in three places: **Concierge bar** (pulsing pill), **Dashboard** products grid, **Resale Agent** suggestion list

---

### Module 16 — Green Credit DeFi Token Swap
**Purpose:** Make Green Credits tradeable as real-value tokens backed by verified carbon reductions.

**How it works:**
- Each Green Credit represents verified carbon avoidance logged in the `carbon_events` table
- Exchange rate is algorithmically calculated from the account's carbon backing ratio:
  ```
  rate = $0.05 + min($0.95, (carbon_saved_kg / green_credits) × $0.10)
  ```
  *Example: 104.8 kg CO₂ saved / 85 GC = $0.173/GC (dynamic, not fixed)*
- **Sell GC for USD Tokens:** Burns GC from wallet, mints USD token balance
- **Buy GC with USD Tokens:** Burns USD balance, mints GC credits
- All swaps execute in an atomic PostgreSQL transaction and are recorded in the `green_credit_transactions` ledger
- Carbon Backing Verification Registry shows: Registry ID, Gold Standard verification badge, carbon intensity ratio, and efficacy bar

**Endpoint:** `POST /api/wallet/trade-credits`
```json
{ "amount": 20, "action": "sell" }
```
**Response:**
```json
{ "ok": true, "usdEarned": 3.46, "exchangeRate": 0.1733 }
```

**Verification (live test):**
```
BEFORE: GC: 105 | USD: $0.00 | Rate: $0.1498/GC
TRADE:  Swapped 20 GC → $3.00 USD Tokens ✅
AFTER:  GC: 85  | USD: $3.00
```

---

### Module 17 — Digital Product Passport
**Purpose:** Immutable full lifecycle timeline for every product.

**How it works:**
- Every significant product event writes a record to `product_passports` table with `event_type`, `detail` (JSONB), and `actor`
- Event types: `manufactured`, `first_sale`, `inspection`, `repair`, `ownership_transfer`, `resale`, `donation`, `end_of_life`
- Passport page (`/passport/:orderId`) renders the full timeline as a visual feed
- Ownership history chain (`ownership_history` table) tracks every owner with timestamp

**Endpoint:** `GET /api/passport/:orderId`

---

### Module 18 — Carbon Accounting Engine
**Purpose:** LCA-style carbon savings calculation for every circular action.

**How it works:**
- Uses embedded carbon data per product (kg CO₂e for manufacturing a new unit)
- Calculates carbon saved vs. manufacturing new: `carbon_saved = embedded_carbon × route_factor`
- Route factors: `zero_warehouse` (0.95), `regional_warehouse` (0.85), `donation_local` (0.90)
- Also tracks: water saved (litres), waste diverted (kg), manufacturing avoided (kg CO₂)
- All carbon events written to `carbon_events` and rolled up in `wallets`

**Endpoint:** `GET /api/carbon/report`

---

### Module 19 — Circular Score + Leaderboard
**Purpose:** Gamify circular behavior with a transparent scoring system.

**How it works:**
- Composite score from 5 dimensions: returns resolved (30%), items resold (25%), items donated (20%), carbon saved (15%), Green Credits earned (10%)
- Score maps to tiers: Beginner → Seedling → Recycler → Advocate → Champion → Legend
- Platform-wide leaderboard ranks all users by score
- City-level ranking shows local percentile

**Live result:**
```
Alex Rivera — Score: 17 | Tier: Beginner | Rank: #1 / 3 users
```

**Endpoint:** `GET /api/circular/score`, `GET /api/circular/leaderboard`

---

### Module 20 — Smart Return Wizard (5 Steps)
**Purpose:** Guide customers through a frictionless, AI-powered return process.

**Step-by-step flow:**
1. **Select Item** — Shows all owned orders eligible for return (`status = 'owned'`)
2. **Upload Item Photos** — Drag-and-drop or camera capture; up to 8 images
3. **Upload Packaging Photos** — Front, back, inside, barcode scan for packaging AI
4. **AI Inspection** — Live progress bar showing all pipeline stages:
   - `Uploading images` → `Vision analysis (Qwen-VL)` → `Damage detection` → `Condition grading` → `Carbon analysis` → `Buyer matching` → `Report generation`
5. **Decision** — Shows:
   - Condition grade badge (A+ → F) with damage list
   - Packaging Intelligence card with reusability score
   - Refurbishment Decision Matrix (resell / refurbish / donate / recycle with profit projections)
   - NGO recommendations for donation path
   - Refurbishment Instructions for repair path
   - One-click action buttons

**Endpoint pipeline:** `POST /api/returns/initiate` → `POST /api/returns/:id/upload` → `POST /api/returns/:id/analyze` → `GET /api/returns/:id/analyze/status` → `POST /api/returns/:id/decision`

---

### Module 21 — Marketplace (6 Channels)
**Purpose:** Multi-channel resale with AI-enhanced checkout.

**Six marketplace channels:**
| Channel | Description |
|---------|------------|
| **Certified Preloved** | AI-graded used products with full condition disclosure |
| **Rental** | Rent for days, weeks, or months |
| **Exchange** | Direct item swaps — no money changes hands |
| **Donation** | Match donors with verified NGOs |
| **Parts & Materials** | Harvest value from end-of-life products |
| **Peer-to-Peer Resale** | C2C resale inside trusted rails |

**Features:**
- Full-text search with category, grade, price range filters and sorting (newest, price asc/desc, popular)
- Paginated results (up to 48/page)
- Pre-checkout: Return Intent Predictor risk gauge + Smart Size Advisor recommendation
- Purchase earns Green Credits + carbon savings; buyer gets `owned` status for future returns
- Seller messaging and review system

**Endpoints:** `GET /api/marketplace/search`, `GET /api/marketplace/listing/:id`, `POST /api/marketplace/buy/:id`

---

## API Reference

### Authentication
```
POST /api/auth/register     Register new user
POST /api/auth/login        Login → { accessToken, refreshToken }
POST /api/auth/refresh      Rotate refresh token
POST /api/auth/logout       Revoke refresh token
```

### Users
```
GET  /api/users/me          Profile + wallet + level
PATCH /api/users/me         Update name/city
GET  /api/users/me/orders   All orders with estimated current value (DCPE)
```

### Returns Pipeline
```
POST /api/returns/initiate              Step 1: Start return
POST /api/returns/:id/upload?role=item  Step 2a: Upload item photos
POST /api/returns/:id/upload?role=packaging  Step 2b: Upload packaging photos
POST /api/returns/:id/analyze           Step 3: Trigger AI analysis job
GET  /api/returns/:id/analyze/status    Poll job status + result
POST /api/returns/:id/decision          Step 4: Commit decision (path: refund/resell/donate/exchange/repair/keep)
```

### Marketplace
```
GET  /api/marketplace/channels                              List 6 channels
GET  /api/marketplace/search?q=&category=&grade=&sort=      Search with filters
GET  /api/marketplace/listing/:id                           Get listing + reviews
POST /api/marketplace/buy/:id                               Purchase listing
POST /api/marketplace/listing/:id/predict-return            Return Intent Predictor (RIP)
GET  /api/marketplace/listing/:id/size-advice               Smart Size Advisor (SSA)
POST /api/marketplace/listing/:id/review                    Post review
POST /api/marketplace/list                                  Create manual listing
```

### Autonomous Resale Agent
```
GET  /api/ara/status         Is the agent enabled?
POST /api/ara/toggle         { "enabled": true } — triggers immediate sweep if enabling
GET  /api/ara/suggestions    Inventory scan with sell/donate/hold recommendations
POST /api/ara/list           { "orderId": "..." } — agent lists a specific item (runs RIP→RDE→DCPE→LAG→NBOE)
```

### Wallet + DeFi
```
GET  /api/wallet             Balance, exchange_rate, usd_balance, cash_value_usd, level
GET  /api/wallet/history     Green Credit transaction ledger
POST /api/wallet/trade-credits  { "amount": 20, "action": "sell"|"buy" } — DeFi token swap
```

### Carbon & Impact
```
GET /api/carbon/report       Personal carbon timeline, by-action breakdown, equivalents
GET /api/impact              Platform-wide public sustainability totals
```

### Circular Score
```
GET /api/circular/score        Personal score, tier, global & city rank, breakdown
GET /api/circular/leaderboard  Full platform leaderboard
```

### Concierge & Notifications
```
GET /api/concierge             AI-ranked proactive recommendations (scan + forecast + CES)
GET /api/concierge/activity    Agent feed (stats + notifications)
GET /api/dashboards/notifications  Full notification list
```

### Dashboards
```
GET /api/dashboards/customer    Owned products, GC balance, activity counts
GET /api/dashboards/seller      Metrics, revenue by month, AI root-cause analysis
GET /api/dashboards/enterprise  ESG metrics, GMV, diversion rate, donation impact, packaging circularity
```

### Digital Product Passport
```
GET /api/passport/:orderId      Full lifecycle timeline + ownership chain
```

### Inspection (Warehouse)
```
GET /api/inspection/:returnId                            Full inspection report
GET /api/inspection/:returnId/pdf                        Download PDF report
GET /api/inspection/:returnId/refurbish-instructions     Step-by-step RRIG instructions
```

### Donations
```
GET /api/donations            My donations with lifecycle stages
POST /api/donations/:id/advance   Advance impact stage (received → verified → distributed → in_use)
GET /api/donations/:id/receipt.pdf  Download tax receipt PDF
```

### AI Endpoints
```
POST /api/ai/sustainability-coach  Personalized circular economy coaching
```

### Admin
```
GET /api/admin/analytics    Platform-wide return stats, risk distribution, fraud cases
GET /api/admin/ai-logs      All AI prediction logs (model, source, latency)
```

---

## User Journeys

### Journey 1: Customer Return Flow
1. Sign in as `alex@example.com`
2. Go to **Return Wizard** → Select "Robot Vacuum" (recently purchased from marketplace)
3. Upload item photos (drag-drop) → Continue
4. Upload packaging photos → Continue
5. Watch AI pipeline run (live progress bar with stage labels)
6. View results: grade badge, packaging score, RDE decision matrix, NGO recommendations
7. Click **Donate** → Select NGO → Confirm → Receive tax receipt and Green Credits

### Journey 2: Autonomous Resale Agent
1. Sign in → Go to **Resale Agent** page (`/agent`)
2. Toggle **Auto Resale Agent ON**
3. Watch the Agent Activity Feed populate with autonomous actions:
   - Items listed with AI-generated titles and DCPE pricing
   - Buyer matches found (NBOE)
   - Low-value items donated to matched NGOs
4. View listings appear in the Marketplace in real time

### Journey 3: Marketplace Purchase → Return
1. Sign in as `alex@example.com`
2. Go to **Marketplace** → Search for items from Jordan's store
3. Open a listing → AI checkout modal shows Return Risk (RIP) and Size Advice (SSA)
4. Confirm purchase → Earn Green Credits + carbon savings
5. Go to **Return Wizard** → Purchased item now appears as returnable ✅

### Journey 4: Green Credit DeFi Trading
1. Sign in → Go to **Wallet** (`/wallet`)
2. View your Green Credits, dynamic exchange rate (carbon-backed), and USD Token balance
3. See the **Carbon Backing Verification Registry**: Registry ID, Gold Standard badge, CO₂/GC ratio
4. Enter 20 in the swap form → Click "Swap GC for USD Tokens"
5. Balance updates: GC decreases, USD Token balance increases
6. Check the **Green Credit Ledger** → trade is recorded with rate and reason

### Journey 5: Enterprise ESG Reporting
1. Sign in as `esg@example.com`
2. Go to **Dashboard** → ESG view shows:
   - Circular GMV, CO₂ saved, waste diverted, water saved
   - Donation Impact: items donated, people impacted, fair market value, tax benefits
   - Packaging Circularity: boxes reused, recycled, waste avoided (kg)
   - Carbon by month chart

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `users` | Auth, roles, size/price preferences, ARA toggle |
| `orders` | Ownership records — `status` drives the full lifecycle |
| `returns` | Return cases with chosen path and status |
| `return_assessments` | AI condition grades, damage list, packaging scores |
| `marketplace_listings` | Listings across 6 channels with markdown schedule |
| `product_passports` | Immutable lifecycle event log per order |
| `ownership_history` | Chain of custody for every item |
| `carbon_events` | Per-action carbon, water, waste tracking |
| `green_credit_transactions` | GC ledger with delta, reason, balance_after |
| `wallets` | Aggregated GC balance, carbon_saved_kg, usd_balance |
| `notifications` | Agent alerts, EOL warnings, messages (`kind`: ara/eol/message) |
| `buyer_matches` | NBOE match scores per listing |
| `fraud_cases` | Detected return fraud cases with risk score |
| `donations` | Donation records with NGO, FMV, tax receipt, impact stages |
| `ngos` | Verified NGO registry with category needs, capacity, urgency |
| `ai_predictions` | Full AI inference log (module, model, source, latency) |

---

## Security

- **Authentication:** JWT access tokens (short-lived) + refresh token rotation; stored server-side with hash verification
- **Authorization:** Role-based access control (`customer`, `seller`, `enterprise`, `admin`) enforced per route
- **Passwords:** bcrypt hashing with configurable salt rounds
- **Input Validation:** Zod schemas on all request bodies
- **SQL Injection:** 100% parameterized queries — no string concatenation
- **File Uploads:** Type allowlist (images/video only), size limits, stored outside web root
- **Rate Limiting:** Global 300 req/min; auth endpoints 40 req/15 min
- **Headers:** Helmet.js (CSP, HSTS, XSS protection)
- **CORS:** Allowlist-only origins

---

## Environment Variables

```env
# server/.env
PORT=4000
DATABASE_URL=postgresql://ccos:ccos@localhost:5433/ccos
JWT_SECRET=your-secret-here
REFRESH_SECRET=your-refresh-secret-here
OPENROUTER_API_KEY=sk-or-...      # Optional — fallback mode works without it
SEED_PASSWORD=Password123!
```

---

*Second Life Commerce — Built for HackOn 2026 | Circular Commerce Operating System v1.0*
