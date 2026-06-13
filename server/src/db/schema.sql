-- Second Life Commerce — production schema (PostgreSQL)
-- Idempotent: safe to run repeatedly.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Identity & accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'customer'
                    CHECK (role IN ('customer','seller','enterprise','admin')),
  city            TEXT DEFAULT 'Seattle',
  zip_code        TEXT DEFAULT '98101',
  is_prime        BOOLEAN DEFAULT TRUE,
  ara_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS wallets (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  green_credits     NUMERIC(14,2) NOT NULL DEFAULT 0,
  carbon_saved_kg   NUMERIC(14,2) NOT NULL DEFAULT 0,
  water_saved_l     NUMERIC(14,2) NOT NULL DEFAULT 0,
  waste_diverted_kg NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Catalog, ownership, orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL,
  brand               TEXT DEFAULT '',
  category            TEXT NOT NULL,
  description         TEXT DEFAULT '',
  msrp                NUMERIC(12,2) NOT NULL,
  weight_kg           NUMERIC(8,3) NOT NULL DEFAULT 1.0,
  embedded_carbon_kg  NUMERIC(10,3) NOT NULL DEFAULT 6.0,  -- mfg CO2e of a new unit
  monthly_depreciation NUMERIC(5,4) NOT NULL DEFAULT 0.015,
  eco_score           INT NOT NULL DEFAULT 60,
  image_url           TEXT DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  order_number    TEXT NOT NULL,
  purchase_price  NUMERIC(12,2) NOT NULL,
  purchased_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  age_months      INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'owned'
                    CHECK (status IN ('owned','return_initiated','listed','sold','donated','recycled','exchanged','rented')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

CREATE TABLE IF NOT EXISTS product_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  return_id       UUID,
  url             TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image','video')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Returns pipeline
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS returns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason_code     TEXT NOT NULL DEFAULT 'changed_mind',
  reason_text     TEXT DEFAULT '',
  refund_amount   NUMERIC(12,2) DEFAULT 0,
  chosen_path     TEXT NOT NULL DEFAULT 'undecided'
                    CHECK (chosen_path IN ('undecided','refund','resell','donate','exchange','repair','keep')),
  status          TEXT NOT NULL DEFAULT 'initiated',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_returns_user ON returns(user_id);

CREATE TABLE IF NOT EXISTS return_assessments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id                UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_id                 UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  grade                    TEXT NOT NULL,
  grade_label              TEXT NOT NULL,
  confidence               NUMERIC(4,3) NOT NULL,
  reasoning                TEXT DEFAULT '',
  recommended_disposition  TEXT DEFAULT '',
  packaging_condition      TEXT DEFAULT '',
  missing_accessories      JSONB DEFAULT '[]',
  source                   TEXT DEFAULT 'ai',     -- vision | vision_fallback | unavailable
  model                    TEXT DEFAULT '',       -- which vision model performed the inspection
  product_type             TEXT DEFAULT '',
  severity                 NUMERIC(4,2) DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS damage_detections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES return_assessments(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  severity        NUMERIC(4,2) NOT NULL DEFAULT 0,   -- 0-10
  confidence      NUMERIC(4,3) NOT NULL DEFAULT 0.9,
  location        TEXT DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Marketplaces
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  product_id      UUID NOT NULL REFERENCES products(id),
  seller_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marketplace     TEXT NOT NULL DEFAULT 'certified_preloved'
                    CHECK (marketplace IN ('certified_preloved','rental','exchange','donation','parts','p2p')),
  title           TEXT NOT NULL,
  description     TEXT DEFAULT '',
  price           NUMERIC(12,2) NOT NULL DEFAULT 0,
  condition_grade TEXT DEFAULT 'A',
  keywords        JSONB DEFAULT '[]',
  features        JSONB DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','sold','reserved','removed')),
  views           INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_listings_marketplace ON marketplace_listings(marketplace, status);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON marketplace_listings(seller_id);

CREATE TABLE IF NOT EXISTS rentals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  renter_id       UUID REFERENCES users(id),
  daily_rate      NUMERIC(12,2) NOT NULL,
  start_date      DATE,
  end_date        DATE,
  deposit         NUMERIC(12,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'available',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id),
  donor_id        UUID NOT NULL REFERENCES users(id),
  ngo_name        TEXT NOT NULL,
  fair_market_value NUMERIC(12,2) DEFAULT 0,
  tax_receipt_id  TEXT,
  impact_stage    TEXT NOT NULL DEFAULT 'received',  -- received|verified|distributed|in_use
  impact_detail   JSONB DEFAULT '{}',                -- e.g. { recipient, end_use, meals_served }
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exchanges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  proposer_id     UUID NOT NULL REFERENCES users(id),
  responder_id    UUID REFERENCES users(id),
  offered_order_id UUID REFERENCES orders(id),
  cash_topup      NUMERIC(12,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'proposed',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  part_name       TEXT NOT NULL,
  compatibility   JSONB DEFAULT '[]',
  price           NUMERIC(12,2) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Digital Product Passport + lifecycle
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_passports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,  -- manufactured|first_sale|inspection|repair|ownership_transfer|resale|donation|end_of_life
  detail          JSONB DEFAULT '{}',
  actor           TEXT DEFAULT 'system',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_passport_order ON product_passports(order_id, created_at);

CREATE TABLE IF NOT EXISTS ownership_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  owner_id        UUID REFERENCES users(id),
  owner_label     TEXT,
  acquired_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repair_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  repair_type     TEXT NOT NULL,
  parts_replaced  JSONB DEFAULT '[]',
  technician      TEXT DEFAULT '',
  cost            NUMERIC(12,2) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Sustainability economy
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carbon_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id          UUID REFERENCES orders(id),
  action            TEXT NOT NULL,  -- resale|donation|repair|rental|buy_preloved
  carbon_saved_kg   NUMERIC(12,3) NOT NULL,
  water_saved_l     NUMERIC(12,3) NOT NULL DEFAULT 0,
  waste_diverted_kg NUMERIC(12,3) NOT NULL DEFAULT 0,
  manufacturing_avoided_kg NUMERIC(12,3) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_carbon_user ON carbon_events(user_id);

CREATE TABLE IF NOT EXISTS green_credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta           NUMERIC(12,2) NOT NULL,  -- +earned / -spent
  reason          TEXT NOT NULL,
  action          TEXT,
  balance_after   NUMERIC(14,2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gc_user ON green_credit_transactions(user_id);

-- ---------------------------------------------------------------------------
-- Matching, fraud, AI audit, ops
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buyer_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id        UUID REFERENCES users(id),
  buyer_label     TEXT,
  location        TEXT,
  distance_miles  NUMERIC(8,1),
  match_score     INT,
  conversion_probability NUMERIC(4,3),
  predicted_days_to_sale INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  reviewer_id     UUID NOT NULL REFERENCES users(id),
  rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body            TEXT DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id),
  recipient_id    UUID NOT NULL REFERENCES users(id),
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT DEFAULT '',
  read            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fraud_cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id       UUID REFERENCES returns(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES users(id),
  fraud_type      TEXT,
  risk_score      NUMERIC(4,3),
  status          TEXT NOT NULL DEFAULT 'open',
  detail          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_predictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  module          TEXT NOT NULL,   -- listing|root_cause|condition|pricing|nbo|coach
  input           JSONB DEFAULT '{}',
  output          JSONB DEFAULT '{}',
  model           TEXT,
  source          TEXT DEFAULT 'ai',   -- ai | fallback
  latency_ms      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_module ON ai_predictions(module);

CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  entity          TEXT,
  entity_id       TEXT,
  meta            JSONB DEFAULT '{}',
  ip              TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seller_metrics (
  seller_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_listings  INT DEFAULT 0,
  total_sold      INT DEFAULT 0,
  return_rate     NUMERIC(5,4) DEFAULT 0,
  revenue         NUMERIC(14,2) DEFAULT 0,
  circular_score  INT DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enterprise_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name        TEXT NOT NULL,
  period          TEXT NOT NULL,
  circular_gmv    NUMERIC(16,2) DEFAULT 0,
  carbon_saved_kg NUMERIC(16,2) DEFAULT 0,
  waste_diverted_kg NUMERIC(16,2) DEFAULT 0,
  return_rate     NUMERIC(5,4) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
