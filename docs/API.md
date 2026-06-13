# CCOS — API Reference (Express backend)

Base URL: `http://localhost:4000`. All bodies JSON unless noted. Auth via
`Authorization: Bearer <accessToken>`. AI mode shown at `GET /api/health`.

## Auth
| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | /api/auth/register | `{email,password,name,role?,city?}` | returns `{user, accessToken, refreshToken}` |
| POST | /api/auth/login | `{email,password}` | returns tokens |
| POST | /api/auth/refresh | `{refreshToken}` | rotates + returns new tokens |
| POST | /api/auth/logout | `{refreshToken}` | revokes |

## Users (auth)
- `GET /api/users/me` → profile + wallet + Carbon-Warrior level
- `PATCH /api/users/me` → `{name?, city?}`
- `GET /api/users/me/orders` → owned items with live estimated value (DCPE)

## Products
- `GET /api/products?category=&q=` · `GET /api/products/:id`

## Returns pipeline (auth)
- `POST /api/returns/initiate` `{orderId, reasonCode?, reasonText?}` → `{return, order}`
- `POST /api/returns/:id/upload` (multipart, field `files`, ≤8 images/video) → stored evidence
- `POST /api/returns/:id/analyze` → `{assessment, root_cause, pricing, options[], recommended, ai_meta}`
  - `assessment`: grade, confidence, reasoning, damages[], packaging, missing_accessories, **source**
  - `options`: per-path `{money, green_credits, carbon_saved_kg, time, note}` for refund/resell/donate/exchange/repair
- `POST /api/returns/:id/decision` `{path, route?, ngoName?}` → commits; resell returns
  `{listing, carbon, green_credits_earned, new_gc_balance, buyer_matches}`

## AI (auth) — each response carries `source: "ai" | "fallback"`
- `POST /api/ai/listing-generator` `{orderId, grade?}`
- `POST /api/ai/root-cause` `{orderId, reasonCode?, reasonText?, comments?}`
- `POST /api/ai/price` `{orderId, grade?}`
- `POST /api/ai/match-buyers` `{orderId, grade?}`
- `POST /api/ai/sustainability-coach`

## Marketplace
- `GET /api/marketplace/channels`
- `GET /api/marketplace/search?q=&category=&marketplace=&grade=&minPrice=&maxPrice=&sort=&page=&pageSize=`
  → `{total, page, page_size, results[]}` (sort: newest|price_asc|price_desc|popular)
- `GET /api/marketplace/listing/:id` → listing + reviews (increments views)
- `POST /api/marketplace/list` (auth) `{productId, marketplace, title, price, conditionGrade, ...}`
- `POST /api/marketplace/buy/:id` (auth) → earns Green Credits + carbon (buy_preloved); transfers ownership
- `POST /api/marketplace/listing/:id/review` (auth) `{rating 1-5, body?}`
- `POST /api/marketplace/listing/:id/message` (auth) `{body}`

## Wallet & carbon (auth)
- `GET /api/wallet` → balance, cash value, level, next level
- `GET /api/wallet/history` → Green Credit ledger
- `GET /api/carbon/report` → totals, equivalents, by_action[], timeline[]

## Passport (public)
- `GET /api/passport/:orderId` → product + current grade + lifecycle events + ownership + repairs

## Dashboards (auth)
- `GET /api/dashboards/customer`
- `GET /api/dashboards/seller`
- `GET /api/dashboards/enterprise` (role enterprise/admin)
- `GET /api/dashboards/notifications`

## Admin (role admin)
- `GET /api/admin/users` · `GET /api/admin/listings` · `PATCH /api/admin/listings/:id/moderate`
- `GET /api/admin/fraud` · `GET /api/admin/ai-logs?module=` · `GET /api/admin/analytics`

## Config (env, see server/.env.example)
`PORT, DATABASE_URL, JWT_*`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `STORAGE_DRIVER`, `CLOUDINARY_URL`.
