# CCOS — Architecture

This documents the architecture of the implemented MVP and how it maps to the production
target from the blueprint (Section 19). The MVP is a true vertical slice: the same service
boundaries, data model, and AI module structure scale up — nothing here is throwaway.

## MVP topology (what's running in this repo)

```
┌────────────────────────────┐        ┌──────────────────────────────────────────────┐
│  Frontend (React + Vite)   │  /api  │  Backend (FastAPI)                             │
│  Tailwind + Framer Motion  │ ─────▶ │  routers/  → services/ (AI engines) → models  │
│  pages: Landing, Return,   │  proxy │  SQLite (SQLAlchemy)                           │
│  Marketplace, Impact, ARA  │        │  deterministic AI  ⇄  optional Bedrock/Rekog.  │
└────────────────────────────┘        └──────────────────────────────────────────────┘
```

- **Frontend** (`frontend/`): SPA. Vite dev server proxies `/api/*` to the backend on :8000.
- **Backend** (`backend/app/`):
  - `routers/` — thin HTTP layer (users, returns, ai, marketplace, sustainability, passport, ara)
  - `services/` — the AI/business engines (one module per blueprint AI module)
  - `models.py` — SQLAlchemy ORM (the data model)
  - `config.py` — feature flags incl. `USE_BEDROCK` to switch AI from local→cloud

## AI routing strategy

Every AI engine has two implementations behind one interface:

| Mode | When | Behaviour |
|------|------|-----------|
| `deterministic-local` (default) | demo / offline | seeded, reproducible outputs — the demo never fails on stage |
| `bedrock` (`CCOS_USE_BEDROCK=1`) | production / with AWS creds | routes to Claude (Bedrock) + Rekognition; falls back to local on any error |

This is the single most important design decision for a hackathon: **the live demo cannot
depend on a network call to an LLM.** The cloud path is wired and ready, but the default is
deterministic.

## Mapping to the production architecture (Section 19)

| Blueprint tier | Production target | MVP implementation |
|----------------|-------------------|--------------------|
| Frontend tier | React PWA + Alexa skill + native apps | React SPA |
| API gateway | AWS API Gateway + CloudFront + Cognito | FastAPI + CORS (auth stubbed) |
| Core API microservices | Returns/Listings/Orders/Users/Inventory/Credits/Carbon | `routers/` + `services/` modules |
| AI services cluster | CV (Rekognition+ViT), GenAI (Bedrock), Rec (SageMaker+Personalize), Fraud (SageMaker) | `services/` engines w/ Bedrock hooks |
| Event streaming | Kinesis + EventBridge | synchronous calls (events are a roadmap item) |
| Data tier | Aurora + DynamoDB + OpenSearch + S3 + Managed Blockchain + Redshift | SQLite (Aurora-shaped schema); DPP stored relationally (blockchain = roadmap) |

## Request flow — the core demo (return → resell)

```
POST /api/returns/initiate
   └─ cv_assessment.assess_condition()   (DDVA)        → ConditionAssessment row
   └─ pricing.recommend_price()          (DCPE)        → resale offer vs refund
POST /api/returns/resell
   └─ listing_generator.generate_listing()  (LAG)      → ResaleListing row
   └─ carbon.calculate_carbon()              (CFCA)    → CarbonRecord row
   └─ green_credits.award_credits()                    → GreenCreditLedger row
   └─ next_best_owner.find_buyers()          (NBOE)    → buyer matches + routing decision
   └─ PassportEvent x2 (inspection, resale)            → Digital Product Passport
```

## Scaling notes (MVP → production)

- **DB**: swap `CCOS_DATABASE_URL` to Postgres/Aurora — SQLAlchemy models are unchanged.
- **Async/events**: emit domain events (`return_initiated`, `item_assessed`, `sale_completed`,
  `credit_earned`) to EventBridge; move heavy AI to async workers behind Kinesis.
- **CV/GenAI**: flip `USE_BEDROCK=1`; the deterministic engines remain as a circuit-breaker fallback.
- **DPP**: anchor `PassportEvent` hashes on Amazon Managed Blockchain; keep the hot copy in the DB.
- **Auth**: front the API with Cognito JWT; `_demo_user` becomes the authenticated principal.
