# Second Life Commerce — Circular Commerce Operating System (CCOS)

A production-grade circular-commerce platform: returns intelligence, AI condition grading,
resale/donation/exchange marketplaces, a verifiable carbon engine, a Green Credits economy,
and Digital Product Passports — built on a real database, real auth, and real AI inference.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + TailwindCSS + Framer Motion + React Query + Recharts |
| Backend | Node.js + Express |
| Database | PostgreSQL (via Docker) |
| Auth | JWT access + refresh-token rotation, bcrypt, RBAC |
| AI | OpenRouter — **vision**: `qwen/qwen3-vl-8b-instruct` (damage detection/grading); **text**: `nvidia/nemotron-3-super-120b-a12b:free` (listings, root-cause, coach) |
| Storage | Local disk (`/uploads`) with a Cloudinary integration point |
| Infra | Docker Compose (db + api + adminer) |

```
second-life-commerce/
├── server/      Express API — auth, returns pipeline, AI, marketplaces, dashboards, admin
├── frontend/    React app — auth, return wizard, marketplace, dashboards, wallet, passport
├── docs/        Architecture / requirements / data model / AI module notes
└── docker-compose.yml
```

## Run it

### 1. Database (Docker)
```bash
docker compose up -d db          # Postgres on host port 5433 (avoids clashing with a local PG)
```

### 2. Backend
```bash
cd server
cp .env.example .env             # set OPENROUTER_API_KEY for real AI; otherwise flagged fallback
npm install
npm run seed                     # migrate schema + seed demo data
npm run dev                      # http://localhost:4000  (health: /api/health)
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

### Or everything in containers
```bash
docker compose up --build        # db + api (+ adminer on :8080). Then run the seed once:
docker compose exec api npm run seed
```

## Demo accounts (password: `Password123!`)
| Role | Email | Sees |
|------|-------|------|
| Customer | alex@example.com | return wizard, wallet, customer dashboard (has purchase history) |
| Seller | jordan@example.com | seller dashboard (listings, revenue, return root causes) |
| Enterprise | esg@example.com | ESG / circular-GMV dashboard |
| Admin | admin@example.com | platform analytics, AI logs, moderation |

## Real, not mocked

- **Persistence** — every value (orders, returns, assessments, listings, credits, carbon, passport
  events) is read from / written to PostgreSQL. Nothing is hardcoded in the UI.
- **AI inference** — condition grading runs a **vision model (Qwen-VL)** on the *actual uploaded
  image bytes* (sent as base64 — OpenRouter can't reach `localhost` URLs). Listing generation,
  return root-cause, and the sustainability coach use the **text model (Nemotron)**. Every AI
  response carries a `source` field (`vision` / `vision_fallback` / `ai` / `fallback` / `unavailable`)
  and the model name, so the UI always shows which model performed the inspection.
- **No fabricated damage** — if vision is unavailable, or returns a severe grade with no supporting
  evidence, or is under 50% confident, the system returns `needs_more_photos`/`unavailable`
  instead of inventing a condition report. Verified: a cracked-screen photo grades **F (0.99
  confidence)** with the crack detected; an inconclusive photo asks for clearer images.
- **Calculations** — carbon savings (LCA-style), resale pricing (depreciation), and Green Credits
  are deterministic formulas (the correct approach for sustainability accounting), defined in
  `server/src/services/`.
- **Buyer matching (NBOE)** — scores real users from the DB by category affinity + geography.

> AI mode is shown at `GET /api/health`. Without a key it runs in transparent `fallback` mode so
> the app is fully functional offline; set `OPENROUTER_API_KEY` to enable live model calls.

## The user journey
1. **Sign in** (or register).
2. **Return Wizard** → select an order → upload photos/video (drag-drop or camera) →
   AI analysis (condition grade, damage detections, root cause) → **decision engine** values
   refund / resell / donate / exchange / repair → commit.
3. Resell → AI listing + Next-Best-Owner matches + verified carbon + Green Credits, all persisted.
4. **Marketplace** → search / filter / sort / paginate; buy preloved (earns credits + carbon).
5. **Wallet** → Green Credit ledger + carbon charts (Recharts).
6. **Dashboard** → role-aware (customer / seller / enterprise + admin).
7. **Product Passport** → full lifecycle timeline for any item.

See `server` API surface in `docs/API.md` and the Swagger-free route list in `server/src/routes/`.

## Security
JWT auth with refresh rotation, bcrypt password hashing, role-based access control, Helmet,
CORS allow-list, per-route rate limiting, Zod request validation, parameterized SQL throughout,
and constrained file uploads (type + size limits).
