--
-- PostgreSQL database dump
--

\restrict nZVRSje0ge23otndX963W78PdPs1BTkSHXNm6iNEeXHj1IsHsbgdaMHGkTagtoe

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: ccos
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO ccos;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: ccos
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_predictions; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.ai_predictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    module text NOT NULL,
    input jsonb DEFAULT '{}'::jsonb,
    output jsonb DEFAULT '{}'::jsonb,
    model text,
    source text DEFAULT 'ai'::text,
    latency_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ai_predictions OWNER TO ccos;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    entity text,
    entity_id text,
    meta jsonb DEFAULT '{}'::jsonb,
    ip text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO ccos;

--
-- Name: browsing_history; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.browsing_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    product_id uuid,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.browsing_history OWNER TO ccos;

--
-- Name: buyer_matches; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.buyer_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid,
    order_id uuid,
    buyer_id uuid,
    buyer_label text,
    location text,
    distance_miles numeric(8,1),
    match_score integer,
    conversion_probability numeric(4,3),
    predicted_days_to_sale integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.buyer_matches OWNER TO ccos;

--
-- Name: carbon_events; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.carbon_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    order_id uuid,
    action text NOT NULL,
    carbon_saved_kg numeric(12,3) NOT NULL,
    water_saved_l numeric(12,3) DEFAULT 0 NOT NULL,
    waste_diverted_kg numeric(12,3) DEFAULT 0 NOT NULL,
    manufacturing_avoided_kg numeric(12,3) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    packaging_reused boolean DEFAULT false,
    packaging_recycled boolean DEFAULT false,
    packaging_waste_avoided_kg numeric(10,2) DEFAULT 0
);


ALTER TABLE public.carbon_events OWNER TO ccos;

--
-- Name: damage_detections; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.damage_detections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assessment_id uuid NOT NULL,
    label text NOT NULL,
    severity numeric(4,2) DEFAULT 0 NOT NULL,
    confidence numeric(4,3) DEFAULT 0.9 NOT NULL,
    location text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.damage_detections OWNER TO ccos;

--
-- Name: donations; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.donations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    donor_id uuid NOT NULL,
    ngo_name text NOT NULL,
    fair_market_value numeric(12,2) DEFAULT 0,
    tax_receipt_id text,
    impact_stage text DEFAULT 'received'::text NOT NULL,
    impact_detail jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ngo_id uuid,
    tax_benefit numeric(12,2) DEFAULT 0
);


ALTER TABLE public.donations OWNER TO ccos;

--
-- Name: enterprise_metrics; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.enterprise_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_name text NOT NULL,
    period text NOT NULL,
    circular_gmv numeric(16,2) DEFAULT 0,
    carbon_saved_kg numeric(16,2) DEFAULT 0,
    waste_diverted_kg numeric(16,2) DEFAULT 0,
    return_rate numeric(5,4) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.enterprise_metrics OWNER TO ccos;

--
-- Name: exchanges; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.exchanges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid,
    proposer_id uuid NOT NULL,
    responder_id uuid,
    offered_order_id uuid,
    cash_topup numeric(12,2) DEFAULT 0,
    status text DEFAULT 'proposed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.exchanges OWNER TO ccos;

--
-- Name: fraud_cases; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.fraud_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    return_id uuid,
    user_id uuid,
    fraud_type text,
    risk_score numeric(4,3),
    status text DEFAULT 'open'::text NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.fraud_cases OWNER TO ccos;

--
-- Name: green_credit_transactions; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.green_credit_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    delta numeric(12,2) NOT NULL,
    reason text NOT NULL,
    action text,
    balance_after numeric(14,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.green_credit_transactions OWNER TO ccos;

--
-- Name: marketplace_listings; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.marketplace_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    product_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    marketplace text DEFAULT 'certified_preloved'::text NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    condition_grade text DEFAULT 'A'::text,
    keywords jsonb DEFAULT '[]'::jsonb,
    features jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'active'::text NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    size text DEFAULT 'M'::text,
    expected_sale_time_days integer DEFAULT 5,
    markdown_schedule jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT marketplace_listings_marketplace_check CHECK ((marketplace = ANY (ARRAY['certified_preloved'::text, 'rental'::text, 'exchange'::text, 'donation'::text, 'parts'::text, 'p2p'::text]))),
    CONSTRAINT marketplace_listings_status_check CHECK ((status = ANY (ARRAY['active'::text, 'sold'::text, 'reserved'::text, 'removed'::text])))
);


ALTER TABLE public.marketplace_listings OWNER TO ccos;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid,
    sender_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.messages OWNER TO ccos;

--
-- Name: ngos; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.ngos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text,
    category_needs jsonb DEFAULT '[]'::jsonb,
    capacity_status text DEFAULT 'open'::text,
    city text DEFAULT 'Seattle'::text,
    distance_miles numeric(8,1),
    urgency_score integer DEFAULT 50,
    beneficiary_type text DEFAULT 'General'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ngos OWNER TO ccos;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO ccos;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    order_number text NOT NULL,
    purchase_price numeric(12,2) NOT NULL,
    purchased_at timestamp with time zone DEFAULT now() NOT NULL,
    age_months integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'owned'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['owned'::text, 'return_initiated'::text, 'listed'::text, 'sold'::text, 'donated'::text, 'recycled'::text, 'exchanged'::text, 'rented'::text])))
);


ALTER TABLE public.orders OWNER TO ccos;

--
-- Name: ownership_history; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.ownership_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    owner_id uuid,
    owner_label text,
    acquired_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ownership_history OWNER TO ccos;

--
-- Name: parts; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid,
    part_name text NOT NULL,
    compatibility jsonb DEFAULT '[]'::jsonb,
    price numeric(12,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.parts OWNER TO ccos;

--
-- Name: product_images; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.product_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    return_id uuid,
    url text NOT NULL,
    kind text DEFAULT 'image'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    role text DEFAULT 'item'::text,
    CONSTRAINT product_images_kind_check CHECK ((kind = ANY (ARRAY['image'::text, 'video'::text])))
);


ALTER TABLE public.product_images OWNER TO ccos;

--
-- Name: product_passports; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.product_passports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    event_type text NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb,
    actor text DEFAULT 'system'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.product_passports OWNER TO ccos;

--
-- Name: products; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    brand text DEFAULT ''::text,
    category text NOT NULL,
    description text DEFAULT ''::text,
    msrp numeric(12,2) NOT NULL,
    weight_kg numeric(8,3) DEFAULT 1.0 NOT NULL,
    embedded_carbon_kg numeric(10,3) DEFAULT 6.0 NOT NULL,
    monthly_depreciation numeric(5,4) DEFAULT 0.015 NOT NULL,
    eco_score integer DEFAULT 60 NOT NULL,
    image_url text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    size text DEFAULT 'M'::text,
    listing_quality_score integer DEFAULT 85
);


ALTER TABLE public.products OWNER TO ccos;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.refresh_tokens OWNER TO ccos;

--
-- Name: rentals; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.rentals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    renter_id uuid,
    daily_rate numeric(12,2) NOT NULL,
    start_date date,
    end_date date,
    deposit numeric(12,2) DEFAULT 0,
    status text DEFAULT 'available'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.rentals OWNER TO ccos;

--
-- Name: repair_history; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.repair_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    repair_type text NOT NULL,
    parts_replaced jsonb DEFAULT '[]'::jsonb,
    technician text DEFAULT ''::text,
    cost numeric(12,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.repair_history OWNER TO ccos;

--
-- Name: return_assessments; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.return_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    return_id uuid NOT NULL,
    order_id uuid NOT NULL,
    grade text NOT NULL,
    grade_label text NOT NULL,
    confidence numeric(4,3) NOT NULL,
    reasoning text DEFAULT ''::text,
    recommended_disposition text DEFAULT ''::text,
    packaging_condition text DEFAULT ''::text,
    missing_accessories jsonb DEFAULT '[]'::jsonb,
    source text DEFAULT 'ai'::text,
    model text DEFAULT ''::text,
    product_type text DEFAULT ''::text,
    severity numeric(4,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    packaging_grade text DEFAULT 'A'::text,
    packaging_reusable boolean DEFAULT true,
    packaging_recyclability numeric(5,2) DEFAULT 96.00,
    packaging_waste_score numeric(5,2) DEFAULT 4.00,
    packaging_recommendation text DEFAULT 'Reuse Original Packaging'::text,
    rde_decision_matrix jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.return_assessments OWNER TO ccos;

--
-- Name: returns; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reason_code text DEFAULT 'changed_mind'::text NOT NULL,
    reason_text text DEFAULT ''::text,
    refund_amount numeric(12,2) DEFAULT 0,
    chosen_path text DEFAULT 'undecided'::text NOT NULL,
    status text DEFAULT 'initiated'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT returns_chosen_path_check CHECK ((chosen_path = ANY (ARRAY['undecided'::text, 'refund'::text, 'resell'::text, 'donate'::text, 'exchange'::text, 'repair'::text, 'keep'::text])))
);


ALTER TABLE public.returns OWNER TO ccos;

--
-- Name: reviews; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid,
    reviewer_id uuid NOT NULL,
    rating integer NOT NULL,
    body text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.reviews OWNER TO ccos;

--
-- Name: seller_metrics; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.seller_metrics (
    seller_id uuid NOT NULL,
    total_listings integer DEFAULT 0,
    total_sold integer DEFAULT 0,
    return_rate numeric(5,4) DEFAULT 0,
    revenue numeric(14,2) DEFAULT 0,
    circular_score integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.seller_metrics OWNER TO ccos;

--
-- Name: users; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    name text NOT NULL,
    role text DEFAULT 'customer'::text NOT NULL,
    city text DEFAULT 'Seattle'::text,
    zip_code text DEFAULT '98101'::text,
    is_prime boolean DEFAULT true,
    ara_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    size_preference text DEFAULT 'M'::text,
    price_sensitivity text DEFAULT 'medium'::text,
    sustainability_score integer DEFAULT 75,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['customer'::text, 'seller'::text, 'enterprise'::text, 'admin'::text])))
);


ALTER TABLE public.users OWNER TO ccos;

--
-- Name: wallets; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.wallets (
    user_id uuid NOT NULL,
    green_credits numeric(14,2) DEFAULT 0 NOT NULL,
    carbon_saved_kg numeric(14,2) DEFAULT 0 NOT NULL,
    water_saved_l numeric(14,2) DEFAULT 0 NOT NULL,
    waste_diverted_kg numeric(14,2) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    packaging_reused_count integer DEFAULT 0,
    packaging_recycled_count integer DEFAULT 0,
    packaging_waste_diverted_kg numeric(10,2) DEFAULT 0,
    usd_balance numeric(14,2) DEFAULT 0.00 NOT NULL
);


ALTER TABLE public.wallets OWNER TO ccos;

--
-- Name: wishlists; Type: TABLE; Schema: public; Owner: ccos
--

CREATE TABLE public.wishlists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    product_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.wishlists OWNER TO ccos;

--
-- Data for Name: ai_predictions; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.ai_predictions (id, user_id, module, input, output, model, source, latency_ms, created_at) FROM stdin;
062b725c-f1cb-4f8d-8a95-ad8a77001778	cf2787d8-438d-4325-ab76-9ce35e3b638e	vision	{"images": 2, "orderId": "c42d0ba3-d3ea-494f-96a3-83478d0c7b13"}	{"grade": "C", "damages": [{"label": "Physical Damage", "location": "Right earbud", "severity": 3, "confidence": 0.99}], "severity": 2, "reasoning": "Right earbud is visibly shattered with internal components exposed, indicating severe damage. Left earbud appears intact but the right one renders the product non-functional for resale. Grading as C due to severe damage on one unit.", "confidence": 0.98, "grade_label": "Moderate Damage", "product_type": "Soundwave Wireless Noise-Cancelling Earbuds", "missing_accessories": [], "packaging_condition": "Not applicable", "recommended_disposition": "parts"}	qwen/qwen3-vl-8b-instruct	vision	3945	2026-06-13 18:07:18.625781+00
5b007d9b-3c52-499f-8951-2b9183e4aa76	cf2787d8-438d-4325-ab76-9ce35e3b638e	packaging	{"image_count": 1}	{"reusable": "NO", "reasoning": "Packaging appears to be a plastic case with visible wear and tear, likely not reusable. Internal components are missing, suggesting it's not in original condition for reuse. Recyclable material but not suitable for reuse.", "confidence": 0.85, "recyclability": 85, "packagingGrade": "C", "recommendations": "Recycle Packaging", "packagingWasteScore": 65}	qwen/qwen3-vl-8b-instruct	vision	2421	2026-06-13 18:07:21.058209+00
cebd0740-188c-4334-a6bf-64bf4f13c719	cf2787d8-438d-4325-ab76-9ce35e3b638e	fraud_detection	{"price": 40, "orderId": "c42d0ba3-d3ea-494f-96a3-83478d0c7b13", "category": "electronics", "returnId": "23ea20d5-230c-4dac-ba8a-631f4e22b736", "weightDiscrepancy": false}	{"details": {"weightMatch": true, "linkedRingRisk": "low", "anomalyDetected": false}, "fraudType": "none", "reasoning": "Approved: Return patterns look normal and weight checks matched.", "fraudProbability": 5, "recommendedAction": "approve"}	deterministic_rules	fallback	1293	2026-06-13 18:07:22.406584+00
4a7dd6f8-74c2-46f1-8bbc-27a7291a6617	cf2787d8-438d-4325-ab76-9ce35e3b638e	root_cause	{"reason": "defective"}	{"confidence": 0.7, "true_reason": "defective", "seller_insights": ["Add more detailed photos and dimensions to the listing.", "Clarify sizing/spec expectations to reduce mismatch returns."]}	deterministic	fallback	0	2026-06-13 18:07:23.284225+00
fdc6645a-78c7-4be5-937c-36e94d25a5a7	cf2787d8-438d-4325-ab76-9ce35e3b638e	vision	{"images": 3, "orderId": "289c887e-cfb4-43fc-a296-ddbfa55c7b89"}	{"grade": "F", "damages": [{"label": "shattered screen", "location": "front", "severity": 5, "confidence": 0.99}, {"label": "water damage", "location": "internal", "severity": 4, "confidence": 0.95}], "severity": 5, "reasoning": "The camera has a shattered screen and visible water damage, indicating it is beyond repair and not suitable for resale or donation. The packaging is also damaged.", "confidence": 0.98, "grade_label": "Parts Only", "product_type": "Vantage 4K Action Camera", "missing_accessories": [], "packaging_condition": "damaged", "recommended_disposition": "recycle"}	qwen/qwen3-vl-8b-instruct	vision	3476	2026-06-13 18:08:31.719571+00
020fcd7e-0bb3-4bcb-8e2a-cffdac8a7cdb	cf2787d8-438d-4325-ab76-9ce35e3b638e	packaging	{"image_count": 1}	{"reusable": "NO", "reasoning": "Packaging is crushed and buried in soil, indicating severe damage and contamination. Not reusable and requires recycling or disposal.", "confidence": 0.98, "recyclability": 85, "packagingGrade": "D", "recommendations": "Recycle or Dispose", "packagingWasteScore": 75}	qwen/qwen3-vl-8b-instruct	vision	1845	2026-06-13 18:08:33.578601+00
19e20422-a016-4c84-bf5d-7e4b66d41cc1	cf2787d8-438d-4325-ab76-9ce35e3b638e	fraud_detection	{"price": 320, "orderId": "289c887e-cfb4-43fc-a296-ddbfa55c7b89", "category": "electronics", "returnId": "8486c4b5-933a-4e4b-b867-2082137b85d5", "weightDiscrepancy": true}	{"details": {"weightMatch": false, "linkedRingRisk": "low", "anomalyDetected": true}, "fraudType": "switch_fraud", "reasoning": "Flagged switch fraud: Physical item weight differs significantly from manufacturing specifications.", "fraudProbability": 50, "recommendedAction": "investigate"}	deterministic_rules	fallback	1000	2026-06-13 18:08:34.594144+00
eddefb73-6900-4c1a-8509-02c87d848d9d	cf2787d8-438d-4325-ab76-9ce35e3b638e	root_cause	{"reason": "defective"}	{"confidence": 0.7, "true_reason": "defective", "seller_insights": ["Add more detailed photos and dimensions to the listing.", "Clarify sizing/spec expectations to reduce mismatch returns."]}	deterministic	fallback	0	2026-06-13 18:08:35.519277+00
dbc6b9a7-3699-49c4-b13e-e5e0a87fc641	cf2787d8-438d-4325-ab76-9ce35e3b638e	return_intent	{"brand": "Vantage", "price": 480, "context": {"day": "Saturday", "season": "Summer", "deviceType": "mobile"}, "behavior": {"timeOnPage": 60, "imagesViewed": 2}, "category": "electronics", "productId": "3cefa32d-213b-4f27-9da6-7637fc34824f"}	{"riskLevel": "LOW", "topFactors": ["Typical category return baseline"], "recommendations": ["Verify shipping & return timelines"], "returnProbability": 26}	deterministic_formula	fallback	1420	2026-06-13 18:18:15.116619+00
9c1bd39f-e532-4d11-b2d1-d480f9e81757	\N	pricing	{"msrp": 800, "grade": "B", "region": "Seattle", "category": "electronics", "ageMonths": 14, "productId": "3cefa32d-213b-4f27-9da6-7637fc34824f", "brandValue": 85, "marketTrends": "stable"}	{"rationale": "58% MSRP retention for condition B, 21% age depreciation over 14mo. Category demand index: 1.08. Adjusted for brand value (85/100) and regional market trends (stable).", "price_floor": 343, "demand_score": 88, "price_ceiling": 421, "price_confidence": 81, "markdown_schedule": [{"day": 0, "price": 390, "percentage": 0}, {"day": 7, "price": 371, "percentage": 5}, {"day": 14, "price": 351, "percentage": 10}, {"day": 21, "price": 343, "percentage": 15}], "recommended_price": 390, "expected_sale_time_days": 2}	deterministic_formula	fallback	867	2026-06-13 18:18:16.002321+00
81bc4ffb-54ee-4277-97b0-fe7bef3ce659	cf2787d8-438d-4325-ab76-9ce35e3b638e	listing	{"via": "ara_auto", "orderId": "e0aaa5bf-bef3-4b00-9301-19eaaad5ea17"}	{"title": "Vantage Mirrorless Camera Body — Certified Preloved (Good)", "features": ["AI condition grade B (Good)", "Certified Preloved — Second Life Guarantee", "Verified carbon savings vs. buying new"], "keywords": ["vantage", "electronics", "certified preloved", "refurbished", "sustainable"], "description": "This Mirrorless Camera Body is in good, fully-functional condition with light cosmetic wear. Gently used for ~14 months, AI-inspected and graded B. Ships with our Second Life Guarantee: full refund if it doesn't match the AI condition report. Yours for $390.", "condition_notes": "Condition disclosure: light wear"}	deterministic	fallback	0	2026-06-13 18:18:16.93359+00
6e4f4132-dc7e-4b32-b493-07a0204eb829	cf2787d8-438d-4325-ab76-9ce35e3b638e	return_intent	{"brand": "TidyBot", "price": 210, "context": {"day": "Saturday", "season": "Summer", "deviceType": "mobile"}, "behavior": {"timeOnPage": 60, "imagesViewed": 2}, "category": "home", "productId": "7cda60fa-2742-486e-80e0-026b3ebe5f61"}	{"riskLevel": "LOW", "topFactors": ["Typical category return baseline"], "recommendations": ["Verify shipping & return timelines"], "returnProbability": 21}	deterministic_formula	fallback	859	2026-06-13 18:18:17.880151+00
dd1a7f33-68c1-485c-b95d-71832f1482d4	\N	pricing	{"msrp": 350, "grade": "B", "region": "Seattle", "category": "home", "ageMonths": 6, "productId": "7cda60fa-2742-486e-80e0-026b3ebe5f61", "brandValue": 85, "marketTrends": "stable"}	{"rationale": "58% MSRP retention for condition B, 9% age depreciation over 6mo. Category demand index: 0.98. Adjusted for brand value (85/100) and regional market trends (stable).", "price_floor": 157, "demand_score": 82, "price_ceiling": 193, "price_confidence": 89, "markdown_schedule": [{"day": 0, "price": 178, "percentage": 0}, {"day": 7, "price": 169, "percentage": 5}, {"day": 14, "price": 160, "percentage": 10}, {"day": 21, "price": 157, "percentage": 15}], "recommended_price": 178, "expected_sale_time_days": 3}	deterministic_formula	fallback	860	2026-06-13 18:18:18.755576+00
77f7da57-5e8c-4786-8118-5002a45a9822	cf2787d8-438d-4325-ab76-9ce35e3b638e	listing	{"via": "ara_auto", "orderId": "58dabde6-18c6-4c07-bcd6-057b25356cd0"}	{"title": "TidyBot Robot Vacuum — Certified Preloved (Good)", "features": ["AI condition grade B (Good)", "Certified Preloved — Second Life Guarantee", "Verified carbon savings vs. buying new"], "keywords": ["tidybot", "home", "certified preloved", "refurbished", "sustainable"], "description": "This Robot Vacuum is in good, fully-functional condition with light cosmetic wear. Gently used for ~6 months, AI-inspected and graded B. Ships with our Second Life Guarantee: full refund if it doesn't match the AI condition report. Yours for $178.", "condition_notes": "Condition disclosure: light wear"}	deterministic	fallback	0	2026-06-13 18:18:19.672397+00
0a00735e-2af6-4ab0-893d-dfc74743d298	cf2787d8-438d-4325-ab76-9ce35e3b638e	return_intent	{"brand": "HomeChef", "price": 174, "context": {"day": "Saturday", "season": "Summer", "deviceType": "mobile"}, "behavior": {"timeOnPage": 60, "imagesViewed": 2}, "category": "home", "productId": "bf4f5fd7-b7bb-4943-b436-043472ba34b6"}	{"riskLevel": "LOW", "topFactors": ["Typical category return baseline"], "recommendations": ["Verify shipping & return timelines"], "returnProbability": 21}	deterministic_formula	fallback	835	2026-06-13 18:18:20.61177+00
66ded1cf-c106-49a4-8790-1cb3c64452a3	\N	pricing	{"msrp": 290, "grade": "B", "region": "Seattle", "category": "home", "ageMonths": 9, "productId": "bf4f5fd7-b7bb-4943-b436-043472ba34b6", "brandValue": 85, "marketTrends": "stable"}	{"rationale": "58% MSRP retention for condition B, 14% age depreciation over 9mo. Category demand index: 0.98. Adjusted for brand value (85/100) and regional market trends (stable).", "price_floor": 124, "demand_score": 82, "price_ceiling": 152, "price_confidence": 86, "markdown_schedule": [{"day": 0, "price": 140, "percentage": 0}, {"day": 7, "price": 133, "percentage": 5}, {"day": 14, "price": 126, "percentage": 10}, {"day": 21, "price": 124, "percentage": 15}], "recommended_price": 140, "expected_sale_time_days": 3}	deterministic_formula	fallback	830	2026-06-13 18:18:21.45405+00
40ca4b1e-4ebf-43b6-8839-d88d6bb16405	cf2787d8-438d-4325-ab76-9ce35e3b638e	listing	{"via": "ara_auto", "orderId": "04d130bd-1712-4d8c-b700-2870fcfedf99"}	{"title": "HomeChef Stand Mixer — Certified Preloved (Good)", "features": ["AI condition grade B (Good)", "Certified Preloved — Second Life Guarantee", "Verified carbon savings vs. buying new"], "keywords": ["homechef", "home", "certified preloved", "refurbished", "sustainable"], "description": "This Stand Mixer is in good, fully-functional condition with light cosmetic wear. Gently used for ~9 months, AI-inspected and graded B. Ships with our Second Life Guarantee: full refund if it doesn't match the AI condition report. Yours for $140.", "condition_notes": "Condition disclosure: light wear"}	deterministic	fallback	0	2026-06-13 18:18:22.1074+00
f0dbe786-5698-48c8-bfdc-59e3c7885b9f	83d0729c-1ad2-4c9f-831d-e2eba4180c34	return_intent	{"brand": "TidyBot", "price": 210, "context": {"day": "Saturday", "season": "Summer", "deviceType": "mobile"}, "behavior": {"timeOnPage": 60, "imagesViewed": 2}, "category": "home", "productId": "7cda60fa-2742-486e-80e0-026b3ebe5f61"}	{"riskLevel": "LOW", "topFactors": ["Typical category return baseline"], "recommendations": ["Verify shipping & return timelines"], "returnProbability": 15}	deterministic_formula	fallback	562	2026-06-13 18:18:22.829402+00
6e24f545-8dfc-422f-b49c-aa812d045b94	\N	pricing	{"msrp": 350, "grade": "B", "region": "Austin", "category": "home", "ageMonths": 5, "productId": "7cda60fa-2742-486e-80e0-026b3ebe5f61", "brandValue": 85, "marketTrends": "stable"}	{"rationale": "58% MSRP retention for condition B, 7% age depreciation over 5mo. Category demand index: 0.98. Adjusted for brand value (85/100) and regional market trends (stable).", "price_floor": 160, "demand_score": 82, "price_ceiling": 196, "price_confidence": 90, "markdown_schedule": [{"day": 0, "price": 181, "percentage": 0}, {"day": 7, "price": 172, "percentage": 5}, {"day": 14, "price": 163, "percentage": 10}, {"day": 21, "price": 160, "percentage": 15}], "recommended_price": 181, "expected_sale_time_days": 3}	deterministic_formula	fallback	564	2026-06-13 18:18:23.407252+00
050014e9-71a5-416d-b4df-99ef74685d9f	83d0729c-1ad2-4c9f-831d-e2eba4180c34	listing	{"via": "ara_auto", "orderId": "1c2e39bc-2201-47c7-87be-315fe2f8a9a4"}	{"title": "TidyBot Robot Vacuum — Certified Preloved (Good)", "features": ["AI condition grade B (Good)", "Certified Preloved — Second Life Guarantee", "Verified carbon savings vs. buying new"], "keywords": ["tidybot", "home", "certified preloved", "refurbished", "sustainable"], "description": "This Robot Vacuum is in good, fully-functional condition with light cosmetic wear. Gently used for ~5 months, AI-inspected and graded B. Ships with our Second Life Guarantee: full refund if it doesn't match the AI condition report. Yours for $181.", "condition_notes": "Condition disclosure: light wear"}	deterministic	fallback	0	2026-06-13 18:18:23.971672+00
5495e978-1b1e-47ec-93e4-9732b687098c	83d0729c-1ad2-4c9f-831d-e2eba4180c34	return_intent	{"brand": "Vantage", "price": 192, "context": {"day": "Saturday", "season": "Summer", "deviceType": "mobile"}, "behavior": {"timeOnPage": 60, "imagesViewed": 2}, "category": "electronics", "productId": "8faf3c5f-1d97-4f02-957f-18ab101d0589"}	{"riskLevel": "LOW", "topFactors": ["Typical category return baseline"], "recommendations": ["Verify shipping & return timelines"], "returnProbability": 20}	deterministic_formula	fallback	603	2026-06-13 18:18:24.695172+00
45d50e55-e76b-4d63-8aa5-d3775bc31289	\N	pricing	{"msrp": 320, "grade": "B", "region": "Austin", "category": "electronics", "ageMonths": 5, "productId": "8faf3c5f-1d97-4f02-957f-18ab101d0589", "brandValue": 85, "marketTrends": "stable"}	{"rationale": "58% MSRP retention for condition B, 7% age depreciation over 5mo. Category demand index: 1.08. Adjusted for brand value (85/100) and regional market trends (stable).", "price_floor": 161, "demand_score": 88, "price_ceiling": 197, "price_confidence": 90, "markdown_schedule": [{"day": 0, "price": 183, "percentage": 0}, {"day": 7, "price": 174, "percentage": 5}, {"day": 14, "price": 165, "percentage": 10}, {"day": 21, "price": 161, "percentage": 15}], "recommended_price": 183, "expected_sale_time_days": 2}	deterministic_formula	fallback	598	2026-06-13 18:18:25.307563+00
7c3b4a60-5578-49db-ae52-cc8a714aa8b2	83d0729c-1ad2-4c9f-831d-e2eba4180c34	listing	{"via": "ara_auto", "orderId": "0885bc6d-6861-439b-9f75-77646471f11e"}	{"title": "Vantage 4K Action Camera — Certified Preloved (Good)", "features": ["AI condition grade B (Good)", "Certified Preloved — Second Life Guarantee", "Verified carbon savings vs. buying new"], "keywords": ["vantage", "electronics", "certified preloved", "refurbished", "sustainable"], "description": "This 4K Action Camera is in good, fully-functional condition with light cosmetic wear. Gently used for ~5 months, AI-inspected and graded B. Ships with our Second Life Guarantee: full refund if it doesn't match the AI condition report. Yours for $183.", "condition_notes": "Condition disclosure: light wear"}	deterministic	fallback	0	2026-06-13 18:18:25.970894+00
afdc7765-cddb-4bb6-beb6-c426084326dd	83d0729c-1ad2-4c9f-831d-e2eba4180c34	return_intent	{"brand": "Sony", "price": 78, "context": {"day": "Saturday", "season": "Summer", "deviceType": "mobile"}, "behavior": {"timeOnPage": 60, "imagesViewed": 2}, "category": "electronics", "productId": "5ffcf66f-290c-44ae-8e9b-3f45cfa28ce0"}	{"riskLevel": "LOW", "topFactors": ["Typical category return baseline"], "recommendations": ["Verify shipping & return timelines"], "returnProbability": 20}	deterministic_formula	fallback	704	2026-06-13 18:18:26.798234+00
7b1e9d79-947c-45b6-ab89-dd215b2e173f	\N	pricing	{"msrp": 130, "grade": "B", "region": "Austin", "category": "electronics", "ageMonths": 5, "productId": "5ffcf66f-290c-44ae-8e9b-3f45cfa28ce0", "brandValue": 85, "marketTrends": "stable"}	{"rationale": "58% MSRP retention for condition B, 7% age depreciation over 5mo. Category demand index: 1.08. Adjusted for brand value (85/100) and regional market trends (stable).", "price_floor": 65, "demand_score": 88, "price_ceiling": 80, "price_confidence": 90, "markdown_schedule": [{"day": 0, "price": 74, "percentage": 0}, {"day": 7, "price": 70, "percentage": 5}, {"day": 14, "price": 67, "percentage": 10}, {"day": 21, "price": 65, "percentage": 15}], "recommended_price": 74, "expected_sale_time_days": 2}	deterministic_formula	fallback	646	2026-06-13 18:18:27.458938+00
66af8f62-fb3a-4ce8-b66b-b09bfd4534de	83d0729c-1ad2-4c9f-831d-e2eba4180c34	listing	{"via": "ara_auto", "orderId": "d2fa141d-d59e-4dbd-a096-40557591cb18"}	{"title": "Sony Bluetooth Portable Speaker — Certified Preloved (Good)", "features": ["AI condition grade B (Good)", "Certified Preloved — Second Life Guarantee", "Verified carbon savings vs. buying new"], "keywords": ["sony", "electronics", "certified preloved", "refurbished", "sustainable"], "description": "This Bluetooth Portable Speaker is in good, fully-functional condition with light cosmetic wear. Gently used for ~5 months, AI-inspected and graded B. Ships with our Second Life Guarantee: full refund if it doesn't match the AI condition report. Yours for $74.", "condition_notes": "Condition disclosure: light wear"}	deterministic	fallback	0	2026-06-13 18:18:27.823105+00
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.audit_logs (id, user_id, action, entity, entity_id, meta, ip, created_at) FROM stdin;
\.


--
-- Data for Name: browsing_history; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.browsing_history (id, user_id, product_id, viewed_at) FROM stdin;
\.


--
-- Data for Name: buyer_matches; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.buyer_matches (id, listing_id, order_id, buyer_id, buyer_label, location, distance_miles, match_score, conversion_probability, predicted_days_to_sale, created_at) FROM stdin;
a0a68b10-bfbb-4950-ad75-088d2b48b36d	\N	57ea17fe-b039-428f-b107-bb4c5d6403cf	83d0729c-1ad2-4c9f-831d-e2eba4180c34	Sarah Chen	South Congress, Austin	4.2	96	0.920	3	2026-06-13 18:06:09.644809+00
85d2d9f6-e79e-4ab5-afc6-6ef9f955a3c5	6c628624-32a5-4c47-8787-81f27f55be68	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	\N	Marcus	Fremont, Seattle	6.5	97	0.892	2	2026-06-13 18:18:16.969636+00
4f0950cd-cb27-4810-b927-4f120cafe4b9	6c628624-32a5-4c47-8787-81f27f55be68	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	\N	Marcus	Fremont, Seattle	12.5	95	0.874	2	2026-06-13 18:18:16.976147+00
64dc0b2d-0e34-4d56-af6e-d43611f495f1	6c628624-32a5-4c47-8787-81f27f55be68	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	\N	Sofia	Ballard, Seattle	2.5	93	0.856	2	2026-06-13 18:18:16.980447+00
b3ad1f67-ddb1-4c41-acdd-8736e79cd6c2	6c628624-32a5-4c47-8787-81f27f55be68	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	\N	James	Ballard, Seattle	11.5	84	0.773	4	2026-06-13 18:18:16.984823+00
a75c043c-6bb4-4c2b-bc2a-c359aaa9a525	6c628624-32a5-4c47-8787-81f27f55be68	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	\N	Marcus	Fremont, Seattle	103.0	77	0.708	7	2026-06-13 18:18:16.989087+00
b4f35ae3-e901-40ba-8c6b-3f0d6187b85e	6c628624-32a5-4c47-8787-81f27f55be68	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	\N	Arjun	Green Lake, Seattle	75.0	76	0.699	7	2026-06-13 18:18:16.99309+00
8619cf06-c2f0-4a6b-9620-014fd7773d5e	6c628624-32a5-4c47-8787-81f27f55be68	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	83d0729c-1ad2-4c9f-831d-e2eba4180c34	Sarah Chen	Green Lake, Austin	63.0	75	0.690	7	2026-06-13 18:18:16.997656+00
584236a8-b25d-4628-8889-b2bbfd0e7ad1	6c628624-32a5-4c47-8787-81f27f55be68	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	\N	Aisha	Green Lake, Seattle	159.0	71	0.653	7	2026-06-13 18:18:17.002225+00
526a76c1-62b0-4f79-a617-87bd0bf4143e	6c628624-32a5-4c47-8787-81f27f55be68	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	\N	Priya	Capitol Hill, Seattle	41.0	69	0.635	7	2026-06-13 18:18:17.006003+00
68ce8fff-48ed-49b7-b90d-d57d22c91e85	6c628624-32a5-4c47-8787-81f27f55be68	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	49b78060-7bcf-4fdc-9c46-b2216531c7ab	Jordan Lee	Queen Anne, Portland	98.0	60	0.552	12	2026-06-13 18:18:17.009749+00
9a6602c2-8418-4434-919f-27661e0d7704	c401ec41-cce7-4681-9936-e60fb483bdda	58dabde6-18c6-4c07-bcd6-057b25356cd0	\N	Zara	Pioneer Square, Seattle	3.5	99	0.911	2	2026-06-13 18:18:19.729069+00
73ad7777-78fe-4726-abb0-97cb3a091b90	c401ec41-cce7-4681-9936-e60fb483bdda	58dabde6-18c6-4c07-bcd6-057b25356cd0	\N	Elena	Fremont, Seattle	12.5	97	0.892	2	2026-06-13 18:18:19.73577+00
0136f9e3-9b7d-4c88-b739-3bbab703bcaf	c401ec41-cce7-4681-9936-e60fb483bdda	58dabde6-18c6-4c07-bcd6-057b25356cd0	\N	Zara	Pioneer Square, Seattle	106.0	92	0.846	2	2026-06-13 18:18:19.7426+00
7034d4b7-54b2-4610-9a31-05f2203e68bc	c401ec41-cce7-4681-9936-e60fb483bdda	58dabde6-18c6-4c07-bcd6-057b25356cd0	\N	Liam	Pioneer Square, Seattle	6.5	91	0.837	4	2026-06-13 18:18:19.748682+00
2994f352-6dff-4c93-8dff-2c554d26fd51	c401ec41-cce7-4681-9936-e60fb483bdda	58dabde6-18c6-4c07-bcd6-057b25356cd0	\N	Marcus	Fremont, Seattle	43.0	81	0.745	4	2026-06-13 18:18:19.753545+00
c45b1be5-c594-4822-ae10-5cf2d98918cf	c401ec41-cce7-4681-9936-e60fb483bdda	58dabde6-18c6-4c07-bcd6-057b25356cd0	\N	Chloe	Queen Anne, Seattle	7.5	78	0.718	7	2026-06-13 18:18:19.75742+00
c0de369f-092f-41e0-86ea-b0f72331a146	c401ec41-cce7-4681-9936-e60fb483bdda	58dabde6-18c6-4c07-bcd6-057b25356cd0	83d0729c-1ad2-4c9f-831d-e2eba4180c34	Sarah Chen	Ballard, Austin	96.0	72	0.662	7	2026-06-13 18:18:19.76101+00
3126c9eb-8b28-472d-a20e-81dd5e7b23a4	c401ec41-cce7-4681-9936-e60fb483bdda	58dabde6-18c6-4c07-bcd6-057b25356cd0	49b78060-7bcf-4fdc-9c46-b2216531c7ab	Jordan Lee	Pioneer Square, Portland	124.0	71	0.653	7	2026-06-13 18:18:19.764758+00
a610e119-d79f-4d49-a11f-116b060edfc8	c401ec41-cce7-4681-9936-e60fb483bdda	58dabde6-18c6-4c07-bcd6-057b25356cd0	\N	Maria	Capitol Hill, Seattle	41.0	62	0.570	12	2026-06-13 18:18:19.767721+00
31b5891e-6bfb-48d9-930e-a68a02cb8862	c401ec41-cce7-4681-9936-e60fb483bdda	58dabde6-18c6-4c07-bcd6-057b25356cd0	\N	Priya	Capitol Hill, Seattle	59.0	62	0.570	12	2026-06-13 18:18:19.770281+00
381329fa-71ae-4904-b7ba-6243394423dc	6206cb2a-fe31-4514-8f26-330940e9fca5	04d130bd-1712-4d8c-b700-2870fcfedf99	\N	Sofia	Ballard, Seattle	5.5	98	0.902	2	2026-06-13 18:18:22.154704+00
a168a747-5614-46fb-8158-40d1bb9ef9ef	6206cb2a-fe31-4514-8f26-330940e9fca5	04d130bd-1712-4d8c-b700-2870fcfedf99	\N	Sofia	Ballard, Seattle	14.5	91	0.837	4	2026-06-13 18:18:22.161685+00
244f2383-ff57-43f5-bceb-2a4295ed870a	6206cb2a-fe31-4514-8f26-330940e9fca5	04d130bd-1712-4d8c-b700-2870fcfedf99	\N	Arjun	Green Lake, Seattle	11.5	89	0.819	4	2026-06-13 18:18:22.167515+00
b3a6d091-f2bb-41da-acf0-42ee9ecfea4c	6206cb2a-fe31-4514-8f26-330940e9fca5	04d130bd-1712-4d8c-b700-2870fcfedf99	\N	Arjun	Green Lake, Seattle	14.5	87	0.800	4	2026-06-13 18:18:22.173449+00
59be2db7-4bfc-4487-855c-8bfbbd9dd702	6206cb2a-fe31-4514-8f26-330940e9fca5	04d130bd-1712-4d8c-b700-2870fcfedf99	\N	Aisha	Green Lake, Seattle	99.0	83	0.764	4	2026-06-13 18:18:22.17986+00
98c04b43-0927-4c7d-8839-cfb671acf0e3	6206cb2a-fe31-4514-8f26-330940e9fca5	04d130bd-1712-4d8c-b700-2870fcfedf99	\N	Elena	Fremont, Seattle	103.0	82	0.754	4	2026-06-13 18:18:22.186923+00
3f066c45-31c8-4c90-9baa-caa4db078192	6206cb2a-fe31-4514-8f26-330940e9fca5	04d130bd-1712-4d8c-b700-2870fcfedf99	\N	Marcus	Fremont, Seattle	181.0	80	0.736	4	2026-06-13 18:18:22.193486+00
dfe4b3b8-ed9f-4d0c-ad4a-29c29db3706d	6206cb2a-fe31-4514-8f26-330940e9fca5	04d130bd-1712-4d8c-b700-2870fcfedf99	83d0729c-1ad2-4c9f-831d-e2eba4180c34	Sarah Chen	Queen Anne, Austin	158.0	73	0.672	7	2026-06-13 18:18:22.200054+00
04220864-b8f7-47da-bd05-a04aa574e7a8	6206cb2a-fe31-4514-8f26-330940e9fca5	04d130bd-1712-4d8c-b700-2870fcfedf99	49b78060-7bcf-4fdc-9c46-b2216531c7ab	Jordan Lee	Queen Anne, Portland	122.0	73	0.672	7	2026-06-13 18:18:22.206641+00
62078307-8d72-471a-86b1-469a72c227ea	6206cb2a-fe31-4514-8f26-330940e9fca5	04d130bd-1712-4d8c-b700-2870fcfedf99	\N	Maria	Capitol Hill, Seattle	107.0	58	0.534	12	2026-06-13 18:18:22.21329+00
87833197-7128-47d6-8c97-f07c148e8025	516f1e06-fcfc-4fca-ad58-962008cabf7c	1c2e39bc-2201-47c7-87be-315fe2f8a9a4	\N	James	Mueller, Austin	14.5	89	0.819	4	2026-06-13 18:18:24.019829+00
625bcf1e-bb3d-4c6d-ae43-11e9f00a314e	516f1e06-fcfc-4fca-ad58-962008cabf7c	1c2e39bc-2201-47c7-87be-315fe2f8a9a4	\N	Priya	South Congress, Austin	4.5	88	0.810	4	2026-06-13 18:18:24.026525+00
9450d66f-afad-45e4-b35e-293cf49c4287	516f1e06-fcfc-4fca-ad58-962008cabf7c	1c2e39bc-2201-47c7-87be-315fe2f8a9a4	\N	Zara	West Lake Hills, Austin	124.0	81	0.745	4	2026-06-13 18:18:24.032535+00
281887b7-9428-4ae1-b7f9-7ea9e72c6a7c	516f1e06-fcfc-4fca-ad58-962008cabf7c	1c2e39bc-2201-47c7-87be-315fe2f8a9a4	cf2787d8-438d-4325-ab76-9ce35e3b638e	Alex Rivera	Hyde Park, Seattle	85.0	79	0.727	7	2026-06-13 18:18:24.038166+00
96a35153-d8ad-4ba8-9886-4a8320515819	516f1e06-fcfc-4fca-ad58-962008cabf7c	1c2e39bc-2201-47c7-87be-315fe2f8a9a4	\N	Chloe	Zilker, Austin	10.5	78	0.718	7	2026-06-13 18:18:24.045103+00
88715163-9738-4a02-96d9-16d4026a189c	516f1e06-fcfc-4fca-ad58-962008cabf7c	1c2e39bc-2201-47c7-87be-315fe2f8a9a4	\N	Priya	South Congress, Austin	10.5	78	0.718	7	2026-06-13 18:18:24.050579+00
cc1b4c64-11f6-4bdd-8650-a54acc1478d6	516f1e06-fcfc-4fca-ad58-962008cabf7c	1c2e39bc-2201-47c7-87be-315fe2f8a9a4	\N	Priya	South Congress, Austin	41.0	77	0.708	7	2026-06-13 18:18:24.056333+00
a2708e39-6424-4a00-9b5f-73c6b30ba962	516f1e06-fcfc-4fca-ad58-962008cabf7c	1c2e39bc-2201-47c7-87be-315fe2f8a9a4	49b78060-7bcf-4fdc-9c46-b2216531c7ab	Jordan Lee	Mueller, Portland	126.0	72	0.662	7	2026-06-13 18:18:24.062904+00
56186458-5f11-42aa-afd5-a29a0aa785c9	516f1e06-fcfc-4fca-ad58-962008cabf7c	1c2e39bc-2201-47c7-87be-315fe2f8a9a4	\N	Chloe	Zilker, Austin	170.0	64	0.589	12	2026-06-13 18:18:24.068386+00
3df6564f-1c2a-45e2-a40d-9962668f0564	516f1e06-fcfc-4fca-ad58-962008cabf7c	1c2e39bc-2201-47c7-87be-315fe2f8a9a4	\N	Chloe	Zilker, Austin	98.0	58	0.534	12	2026-06-13 18:18:24.074852+00
e35933c0-ddc5-4474-8dcc-b7246162cb7e	77c39b8e-b1d8-4899-b94d-b856b5d03bb3	0885bc6d-6861-439b-9f75-77646471f11e	\N	Elena	Hyde Park, Austin	9.5	99	0.911	2	2026-06-13 18:18:26.018225+00
cc5aad0d-e93a-4928-87df-33f7b718ccc4	77c39b8e-b1d8-4899-b94d-b856b5d03bb3	0885bc6d-6861-439b-9f75-77646471f11e	\N	Marcus	Hyde Park, Austin	15.5	97	0.892	2	2026-06-13 18:18:26.024601+00
e315f5ff-6951-4f7a-b7d8-4d70ea6f6e92	77c39b8e-b1d8-4899-b94d-b856b5d03bb3	0885bc6d-6861-439b-9f75-77646471f11e	\N	Zara	West Lake Hills, Austin	15.5	94	0.865	2	2026-06-13 18:18:26.030562+00
0ffe00d5-bd85-4929-9d71-24bf162f01e9	77c39b8e-b1d8-4899-b94d-b856b5d03bb3	0885bc6d-6861-439b-9f75-77646471f11e	cf2787d8-438d-4325-ab76-9ce35e3b638e	Alex Rivera	Zilker, Seattle	68.0	85	0.782	4	2026-06-13 18:18:26.036944+00
ed646059-5262-42ba-808c-1867b075e797	77c39b8e-b1d8-4899-b94d-b856b5d03bb3	0885bc6d-6861-439b-9f75-77646471f11e	\N	Marcus	Hyde Park, Austin	115.0	81	0.745	4	2026-06-13 18:18:26.043866+00
7165e0c0-8e54-4db3-9b21-83343bbbe46c	77c39b8e-b1d8-4899-b94d-b856b5d03bb3	0885bc6d-6861-439b-9f75-77646471f11e	\N	Dev	Zilker, Austin	7.5	77	0.708	7	2026-06-13 18:18:26.050725+00
4bb02734-c237-451e-9c7b-d8509f18dc86	77c39b8e-b1d8-4899-b94d-b856b5d03bb3	0885bc6d-6861-439b-9f75-77646471f11e	\N	Chloe	Zilker, Austin	152.0	71	0.653	7	2026-06-13 18:18:26.057408+00
d2ba1e28-98ac-4a25-bc7c-595dde425825	77c39b8e-b1d8-4899-b94d-b856b5d03bb3	0885bc6d-6861-439b-9f75-77646471f11e	\N	Aisha	Downtown, Austin	165.0	69	0.635	7	2026-06-13 18:18:26.064123+00
475d17ba-cd78-455d-83bb-4ebf495bc1e5	77c39b8e-b1d8-4899-b94d-b856b5d03bb3	0885bc6d-6861-439b-9f75-77646471f11e	49b78060-7bcf-4fdc-9c46-b2216531c7ab	Jordan Lee	Zilker, Portland	164.0	65	0.598	7	2026-06-13 18:18:26.070585+00
662a5e6d-7084-4a8a-a98b-c7b170b32f89	77c39b8e-b1d8-4899-b94d-b856b5d03bb3	0885bc6d-6861-439b-9f75-77646471f11e	\N	Priya	South Congress, Austin	65.0	63	0.580	12	2026-06-13 18:18:26.076936+00
fc60898e-9b65-4d23-827d-1ef470fffeb9	a73e7d73-07e3-4fdf-8922-899329123498	d2fa141d-d59e-4dbd-a096-40557591cb18	\N	Zara	West Lake Hills, Austin	6.5	97	0.892	2	2026-06-13 18:18:27.869664+00
bb7216ad-4f5a-462a-83d1-e24db31e9715	a73e7d73-07e3-4fdf-8922-899329123498	d2fa141d-d59e-4dbd-a096-40557591cb18	\N	Liam	West Lake Hills, Austin	9.5	94	0.865	2	2026-06-13 18:18:27.875485+00
b68e58bb-819b-4411-8168-24626fe0fb12	a73e7d73-07e3-4fdf-8922-899329123498	d2fa141d-d59e-4dbd-a096-40557591cb18	\N	Priya	South Congress, Austin	7.5	92	0.846	2	2026-06-13 18:18:27.881639+00
439d4725-9067-4a6a-a16f-ae177d58f87b	a73e7d73-07e3-4fdf-8922-899329123498	d2fa141d-d59e-4dbd-a096-40557591cb18	\N	Elena	Hyde Park, Austin	85.0	87	0.800	4	2026-06-13 18:18:27.887486+00
f0d590a1-1041-45c1-bc58-fe77446a12a0	a73e7d73-07e3-4fdf-8922-899329123498	d2fa141d-d59e-4dbd-a096-40557591cb18	cf2787d8-438d-4325-ab76-9ce35e3b638e	Alex Rivera	Downtown, Seattle	105.0	84	0.773	4	2026-06-13 18:18:27.893443+00
fe4ecffa-e563-4bb7-ad4f-223e9aa5783e	a73e7d73-07e3-4fdf-8922-899329123498	d2fa141d-d59e-4dbd-a096-40557591cb18	\N	Zara	West Lake Hills, Austin	112.0	82	0.754	4	2026-06-13 18:18:27.90086+00
5263b0fd-713e-4946-abe6-0a2041201eee	a73e7d73-07e3-4fdf-8922-899329123498	d2fa141d-d59e-4dbd-a096-40557591cb18	\N	Dev	Zilker, Austin	10.5	82	0.754	4	2026-06-13 18:18:27.907529+00
1e652315-6283-4aa1-a8b7-b4128e9e9f15	a73e7d73-07e3-4fdf-8922-899329123498	d2fa141d-d59e-4dbd-a096-40557591cb18	\N	James	Mueller, Austin	120.0	73	0.672	7	2026-06-13 18:18:27.913682+00
0d100cf7-f468-49f1-a4d6-f635b270d80f	a73e7d73-07e3-4fdf-8922-899329123498	d2fa141d-d59e-4dbd-a096-40557591cb18	\N	Chloe	Zilker, Austin	92.0	65	0.598	7	2026-06-13 18:18:27.919382+00
55379fa6-8e2a-4598-b4c9-bacec4409a77	a73e7d73-07e3-4fdf-8922-899329123498	d2fa141d-d59e-4dbd-a096-40557591cb18	49b78060-7bcf-4fdc-9c46-b2216531c7ab	Jordan Lee	Hyde Park, Portland	139.0	63	0.580	12	2026-06-13 18:18:27.925196+00
\.


--
-- Data for Name: carbon_events; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.carbon_events (id, user_id, order_id, action, carbon_saved_kg, water_saved_l, waste_diverted_kg, manufacturing_avoided_kg, created_at, packaging_reused, packaging_recycled, packaging_waste_avoided_kg) FROM stdin;
a10cae58-b311-43e7-aef0-2ef2411a6bb8	cf2787d8-438d-4325-ab76-9ce35e3b638e	57ea17fe-b039-428f-b107-bb4c5d6403cf	resale	28.700	68.900	0.900	27.200	2026-06-13 18:06:09.644809+00	f	f	0.00
960ec143-c66d-4931-b902-45fa80a2ad5b	cf2787d8-438d-4325-ab76-9ce35e3b638e	9dfb8544-6de7-4614-bc6e-6162ec6cea87	donation	16.800	46.800	0.800	18.200	2026-06-13 18:06:09.644809+00	f	f	0.00
\.


--
-- Data for Name: damage_detections; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.damage_detections (id, assessment_id, label, severity, confidence, location, created_at) FROM stdin;
639c1c43-4404-409e-a1cd-7a2b658ad058	b21136dc-b146-4f37-bf48-31619854e134	Physical Damage	3.00	0.990	Right earbud	2026-06-13 18:07:21.072977+00
a34973e2-8457-4e3a-ae4a-a58ae0be7ddd	824b14d3-d314-4ec3-9562-bbe93e08ca59	shattered screen	5.00	0.990	front	2026-06-13 18:08:33.581999+00
6a03f4b0-8d68-4986-bf37-12ae13e0cb08	824b14d3-d314-4ec3-9562-bbe93e08ca59	water damage	4.00	0.950	internal	2026-06-13 18:08:33.581999+00
\.


--
-- Data for Name: donations; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.donations (id, order_id, donor_id, ngo_name, fair_market_value, tax_receipt_id, impact_stage, impact_detail, status, created_at, ngo_id, tax_benefit) FROM stdin;
2929d994-6c49-452a-bd19-8e64e1a0dca4	9dfb8544-6de7-4614-bc6e-6162ec6cea87	cf2787d8-438d-4325-ab76-9ce35e3b638e	Seattle Community Shelter	78.00	TR-1781373969731	distributed	{"end_use": "Winter warmth for families", "est_meals": 0, "recipient": "Seattle Community Shelter", "est_people_helped": 2}	confirmed	2026-06-13 18:06:09.644809+00	\N	0.00
\.


--
-- Data for Name: enterprise_metrics; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.enterprise_metrics (id, org_name, period, circular_gmv, carbon_saved_kg, waste_diverted_kg, return_rate, created_at) FROM stdin;
\.


--
-- Data for Name: exchanges; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.exchanges (id, listing_id, proposer_id, responder_id, offered_order_id, cash_topup, status, created_at) FROM stdin;
\.


--
-- Data for Name: fraud_cases; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.fraud_cases (id, return_id, user_id, fraud_type, risk_score, status, detail, created_at) FROM stdin;
ae297e46-732b-4d6e-a26c-19b7493cc47a	8486c4b5-933a-4e4b-b867-2082137b85d5	cf2787d8-438d-4325-ab76-9ce35e3b638e	switch_fraud	0.500	open	{"details": {"weightMatch": false, "linkedRingRisk": "low", "anomalyDetected": true}, "fraudType": "switch_fraud", "reasoning": "Flagged switch fraud: Physical item weight differs significantly from manufacturing specifications.", "fraudProbability": 50, "recommendedAction": "investigate"}	2026-06-13 18:08:34.589195+00
\.


--
-- Data for Name: green_credit_transactions; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.green_credit_transactions (id, user_id, delta, reason, action, balance_after, created_at) FROM stdin;
aa752d97-aff5-4121-aeed-88b75d50a9fc	cf2787d8-438d-4325-ab76-9ce35e3b638e	29.00	Resold Sony Speaker	resale	29.00	2026-06-13 18:06:09.644809+00
fed66bab-efad-45a3-879a-b6a2c6a1e669	cf2787d8-438d-4325-ab76-9ce35e3b638e	17.00	Donated Down Jacket	donation	46.00	2026-06-13 18:06:09.644809+00
b621fe96-a2bb-4002-a9ef-44f6c220d0b3	cf2787d8-438d-4325-ab76-9ce35e3b638e	-40.00	Swapped 40 GC for $5.96 USD Tokens (Rate: $0.1489/GC)	trade_credits	6.00	2026-06-13 18:16:19.328138+00
\.


--
-- Data for Name: marketplace_listings; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.marketplace_listings (id, order_id, product_id, seller_id, marketplace, title, description, price, condition_grade, keywords, features, status, views, created_at, size, expected_sale_time_days, markdown_schedule) FROM stdin;
1bb30582-bde4-438d-b8f3-943f50c3df32	57ea17fe-b039-428f-b107-bb4c5d6403cf	5ffcf66f-290c-44ae-8e9b-3f45cfa28ce0	cf2787d8-438d-4325-ab76-9ce35e3b638e	certified_preloved	Sony Bluetooth Portable Speaker — Certified Preloved (Excellent)	AI-inspected, Grade A. Minimal wear. Second Life Guarantee.	88.00	A	[]	[]	sold	0	2026-06-13 18:06:09.644809+00	M	5	[]
ddcc2bb1-029d-4009-ac6d-da9eef977aea	e3ed100e-22a9-4ae5-b4eb-581c0841b8db	7cda60fa-2742-486e-80e0-026b3ebe5f61	49b78060-7bcf-4fdc-9c46-b2216531c7ab	certified_preloved	Robot Vacuum — Certified Preloved (Excellent)	AI-inspected. Second Life Guarantee.	210.00	A	[]	[]	active	0	2026-06-13 18:06:09.644809+00	M	5	[]
dae1673b-23f0-4ccb-be32-63f00d88f9b7	ed3dbf6a-b658-4ad6-aab6-9d53541188af	f3b5c95f-af46-4acf-b6b7-2271a6b0abd2	49b78060-7bcf-4fdc-9c46-b2216531c7ab	certified_preloved	Running Shoes — Certified Preloved (Like New)	AI-inspected. Second Life Guarantee.	78.00	A+	[]	[]	active	0	2026-06-13 18:06:09.644809+00	M	5	[]
6c628624-32a5-4c47-8787-81f27f55be68	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	3cefa32d-213b-4f27-9da6-7637fc34824f	cf2787d8-438d-4325-ab76-9ce35e3b638e	certified_preloved	Vantage Mirrorless Camera Body — Certified Preloved (Good)	This Mirrorless Camera Body is in good, fully-functional condition with light cosmetic wear. Gently used for ~14 months, AI-inspected and graded B. Ships with our Second Life Guarantee: full refund if it doesn't match the AI condition report. Yours for $390.	390.00	B	["vantage", "electronics", "certified preloved", "refurbished", "sustainable"]	["AI condition grade B (Good)", "Certified Preloved — Second Life Guarantee", "Verified carbon savings vs. buying new"]	active	0	2026-06-13 18:18:16.945494+00	M	2	[{"day": 0, "price": 390, "percentage": 0}, {"day": 7, "price": 371, "percentage": 5}, {"day": 14, "price": 351, "percentage": 10}, {"day": 21, "price": 343, "percentage": 15}]
c401ec41-cce7-4681-9936-e60fb483bdda	58dabde6-18c6-4c07-bcd6-057b25356cd0	7cda60fa-2742-486e-80e0-026b3ebe5f61	cf2787d8-438d-4325-ab76-9ce35e3b638e	certified_preloved	TidyBot Robot Vacuum — Certified Preloved (Good)	This Robot Vacuum is in good, fully-functional condition with light cosmetic wear. Gently used for ~6 months, AI-inspected and graded B. Ships with our Second Life Guarantee: full refund if it doesn't match the AI condition report. Yours for $178.	178.00	B	["tidybot", "home", "certified preloved", "refurbished", "sustainable"]	["AI condition grade B (Good)", "Certified Preloved — Second Life Guarantee", "Verified carbon savings vs. buying new"]	active	0	2026-06-13 18:18:19.687455+00	M	3	[{"day": 0, "price": 178, "percentage": 0}, {"day": 7, "price": 169, "percentage": 5}, {"day": 14, "price": 160, "percentage": 10}, {"day": 21, "price": 157, "percentage": 15}]
6206cb2a-fe31-4514-8f26-330940e9fca5	04d130bd-1712-4d8c-b700-2870fcfedf99	bf4f5fd7-b7bb-4943-b436-043472ba34b6	cf2787d8-438d-4325-ab76-9ce35e3b638e	certified_preloved	HomeChef Stand Mixer — Certified Preloved (Good)	This Stand Mixer is in good, fully-functional condition with light cosmetic wear. Gently used for ~9 months, AI-inspected and graded B. Ships with our Second Life Guarantee: full refund if it doesn't match the AI condition report. Yours for $140.	140.00	B	["homechef", "home", "certified preloved", "refurbished", "sustainable"]	["AI condition grade B (Good)", "Certified Preloved — Second Life Guarantee", "Verified carbon savings vs. buying new"]	active	0	2026-06-13 18:18:22.122824+00	M	3	[{"day": 0, "price": 140, "percentage": 0}, {"day": 7, "price": 133, "percentage": 5}, {"day": 14, "price": 126, "percentage": 10}, {"day": 21, "price": 124, "percentage": 15}]
516f1e06-fcfc-4fca-ad58-962008cabf7c	1c2e39bc-2201-47c7-87be-315fe2f8a9a4	7cda60fa-2742-486e-80e0-026b3ebe5f61	83d0729c-1ad2-4c9f-831d-e2eba4180c34	certified_preloved	TidyBot Robot Vacuum — Certified Preloved (Good)	This Robot Vacuum is in good, fully-functional condition with light cosmetic wear. Gently used for ~5 months, AI-inspected and graded B. Ships with our Second Life Guarantee: full refund if it doesn't match the AI condition report. Yours for $181.	181.00	B	["tidybot", "home", "certified preloved", "refurbished", "sustainable"]	["AI condition grade B (Good)", "Certified Preloved — Second Life Guarantee", "Verified carbon savings vs. buying new"]	active	0	2026-06-13 18:18:23.985621+00	M	3	[{"day": 0, "price": 181, "percentage": 0}, {"day": 7, "price": 172, "percentage": 5}, {"day": 14, "price": 163, "percentage": 10}, {"day": 21, "price": 160, "percentage": 15}]
77c39b8e-b1d8-4899-b94d-b856b5d03bb3	0885bc6d-6861-439b-9f75-77646471f11e	8faf3c5f-1d97-4f02-957f-18ab101d0589	83d0729c-1ad2-4c9f-831d-e2eba4180c34	certified_preloved	Vantage 4K Action Camera — Certified Preloved (Good)	This 4K Action Camera is in good, fully-functional condition with light cosmetic wear. Gently used for ~5 months, AI-inspected and graded B. Ships with our Second Life Guarantee: full refund if it doesn't match the AI condition report. Yours for $183.	183.00	B	["vantage", "electronics", "certified preloved", "refurbished", "sustainable"]	["AI condition grade B (Good)", "Certified Preloved — Second Life Guarantee", "Verified carbon savings vs. buying new"]	active	0	2026-06-13 18:18:25.985357+00	M	2	[{"day": 0, "price": 183, "percentage": 0}, {"day": 7, "price": 174, "percentage": 5}, {"day": 14, "price": 165, "percentage": 10}, {"day": 21, "price": 161, "percentage": 15}]
a73e7d73-07e3-4fdf-8922-899329123498	d2fa141d-d59e-4dbd-a096-40557591cb18	5ffcf66f-290c-44ae-8e9b-3f45cfa28ce0	83d0729c-1ad2-4c9f-831d-e2eba4180c34	certified_preloved	Sony Bluetooth Portable Speaker — Certified Preloved (Good)	This Bluetooth Portable Speaker is in good, fully-functional condition with light cosmetic wear. Gently used for ~5 months, AI-inspected and graded B. Ships with our Second Life Guarantee: full refund if it doesn't match the AI condition report. Yours for $74.	74.00	B	["sony", "electronics", "certified preloved", "refurbished", "sustainable"]	["AI condition grade B (Good)", "Certified Preloved — Second Life Guarantee", "Verified carbon savings vs. buying new"]	active	0	2026-06-13 18:18:27.836481+00	M	2	[{"day": 0, "price": 74, "percentage": 0}, {"day": 7, "price": 70, "percentage": 5}, {"day": 14, "price": 67, "percentage": 10}, {"day": 21, "price": 65, "percentage": 15}]
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.messages (id, listing_id, sender_id, recipient_id, body, created_at) FROM stdin;
\.


--
-- Data for Name: ngos; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.ngos (id, name, description, category_needs, capacity_status, city, distance_miles, urgency_score, beneficiary_type, created_at) FROM stdin;
11152bfb-7e4b-42e3-be01-ef511ac21a3b	Tech Kids Foundation	Provides refurbished devices to children in need	["electronics"]	open	Seattle	4.2	95	Children	2026-06-13 12:12:37.953855+00
55ebab87-1ef7-4977-a784-614796d07b6f	Red Cross Seattle	Disaster relief and clothing/home distribution	["apparel", "home"]	open	Seattle	3.5	90	Displaced Families	2026-06-13 12:12:37.953855+00
c154926f-4d29-440b-9e24-d5bd57570896	Green Earth Habitat	Eco-friendly furniture and home redistribution	["home"]	medium	Seattle	2.1	60	Low-income Families	2026-06-13 12:12:37.953855+00
92687d12-f10e-4ab5-a67f-bdb92bec61b4	Austin Community Shelter	Provides clothing and home essentials in Austin	["apparel", "home"]	open	Austin	5.0	85	Homeless Individuals	2026-06-13 12:12:37.953855+00
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.notifications (id, user_id, kind, title, body, read, created_at) FROM stdin;
422c5398-ce4f-44bb-adb2-2b0e638f2a49	cf2787d8-438d-4325-ab76-9ce35e3b638e	eol	Predictive End-of-Life Notification	Your item (Wireless Noise-Cancelling Earbuds) will reach near-zero resale value in ~3 months. List now for $24.	f	2026-06-13 18:06:13.223818+00
c3f5aba1-c247-4a19-9f75-0345e32071e1	cf2787d8-438d-4325-ab76-9ce35e3b638e	ara	Agent listed an item	Your Mirrorless Camera Body has been autonomously listed for $390 with 10 buyer matches.	f	2026-06-13 18:18:17.013349+00
41019005-49f7-41ef-96cc-6482234a40cc	cf2787d8-438d-4325-ab76-9ce35e3b638e	ara	Agent listed an item	Your Robot Vacuum has been autonomously listed for $178 with 10 buyer matches.	f	2026-06-13 18:18:19.772742+00
7b1c03aa-c704-41ff-84dc-c7f7bb43ae90	cf2787d8-438d-4325-ab76-9ce35e3b638e	ara	Agent listed an item	Your Stand Mixer has been autonomously listed for $140 with 10 buyer matches.	f	2026-06-13 18:18:22.219641+00
c9039d06-62b8-481b-825a-8b2f1e46a549	83d0729c-1ad2-4c9f-831d-e2eba4180c34	ara	Agent listed an item	Your Robot Vacuum has been autonomously listed for $181 with 10 buyer matches.	f	2026-06-13 18:18:24.081028+00
b93b5f86-c093-41c1-a12f-bc25344f6bf3	83d0729c-1ad2-4c9f-831d-e2eba4180c34	ara	Agent listed an item	Your 4K Action Camera has been autonomously listed for $183 with 10 buyer matches.	f	2026-06-13 18:18:26.082722+00
528f046e-5950-4124-8d1f-72af052cddd3	83d0729c-1ad2-4c9f-831d-e2eba4180c34	ara	Agent listed an item	Your Bluetooth Portable Speaker has been autonomously listed for $74 with 10 buyer matches.	f	2026-06-13 18:18:27.931593+00
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.orders (id, user_id, product_id, order_number, purchase_price, purchased_at, age_months, status, created_at) FROM stdin;
57ea17fe-b039-428f-b107-bb4c5d6403cf	cf2787d8-438d-4325-ab76-9ce35e3b638e	5ffcf66f-290c-44ae-8e9b-3f45cfa28ce0	ORD-1003	130.00	2025-10-16 18:06:09.683+00	8	sold	2026-06-13 18:06:09.644809+00
9dfb8544-6de7-4614-bc6e-6162ec6cea87	cf2787d8-438d-4325-ab76-9ce35e3b638e	b5f04b34-cfdb-47fc-b509-04786af26ab5	ORD-1004	180.00	2025-11-15 18:06:09.687+00	7	donated	2026-06-13 18:06:09.644809+00
e3ed100e-22a9-4ae5-b4eb-581c0841b8db	49b78060-7bcf-4fdc-9c46-b2216531c7ab	7cda60fa-2742-486e-80e0-026b3ebe5f61	ORD-1010	315.00	2026-06-13 18:06:09.644809+00	10	listed	2026-06-13 18:06:09.644809+00
ed3dbf6a-b658-4ad6-aab6-9d53541188af	49b78060-7bcf-4fdc-9c46-b2216531c7ab	f3b5c95f-af46-4acf-b6b7-2271a6b0abd2	ORD-1011	117.00	2026-06-13 18:06:09.644809+00	10	listed	2026-06-13 18:06:09.644809+00
c42d0ba3-d3ea-494f-96a3-83478d0c7b13	cf2787d8-438d-4325-ab76-9ce35e3b638e	5aeb5030-35f0-4cf3-9895-52a3b59e3eed	ORD-1000	40.00	2026-05-14 18:06:09.667+00	1	return_initiated	2026-06-13 18:06:09.644809+00
289c887e-cfb4-43fc-a296-ddbfa55c7b89	cf2787d8-438d-4325-ab76-9ce35e3b638e	8faf3c5f-1d97-4f02-957f-18ab101d0589	ORD-1001	320.00	2025-07-18 18:06:09.674+00	11	return_initiated	2026-06-13 18:06:09.644809+00
e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	cf2787d8-438d-4325-ab76-9ce35e3b638e	3cefa32d-213b-4f27-9da6-7637fc34824f	ORD-1002	800.00	2025-04-19 18:06:09.678+00	14	listed	2026-06-13 18:06:09.644809+00
58dabde6-18c6-4c07-bcd6-057b25356cd0	cf2787d8-438d-4325-ab76-9ce35e3b638e	7cda60fa-2742-486e-80e0-026b3ebe5f61	ORD-1006	350.00	2025-12-15 18:06:09.697+00	6	listed	2026-06-13 18:06:09.644809+00
04d130bd-1712-4d8c-b700-2870fcfedf99	cf2787d8-438d-4325-ab76-9ce35e3b638e	bf4f5fd7-b7bb-4943-b436-043472ba34b6	ORD-1005	290.00	2025-09-16 18:06:09.692+00	9	listed	2026-06-13 18:06:09.644809+00
1c2e39bc-2201-47c7-87be-315fe2f8a9a4	83d0729c-1ad2-4c9f-831d-e2eba4180c34	7cda60fa-2742-486e-80e0-026b3ebe5f61	ORD-1008	350.00	2026-06-13 18:06:09.644809+00	5	listed	2026-06-13 18:06:09.644809+00
0885bc6d-6861-439b-9f75-77646471f11e	83d0729c-1ad2-4c9f-831d-e2eba4180c34	8faf3c5f-1d97-4f02-957f-18ab101d0589	ORD-1009	320.00	2026-06-13 18:06:09.644809+00	5	listed	2026-06-13 18:06:09.644809+00
d2fa141d-d59e-4dbd-a096-40557591cb18	83d0729c-1ad2-4c9f-831d-e2eba4180c34	5ffcf66f-290c-44ae-8e9b-3f45cfa28ce0	ORD-1007	130.00	2026-06-13 18:06:09.644809+00	5	listed	2026-06-13 18:06:09.644809+00
\.


--
-- Data for Name: ownership_history; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.ownership_history (id, order_id, owner_id, owner_label, acquired_at) FROM stdin;
b57e99a5-bc60-467f-8a1e-be5b75d5aba4	c42d0ba3-d3ea-494f-96a3-83478d0c7b13	cf2787d8-438d-4325-ab76-9ce35e3b638e	Alex Rivera	2026-05-14 18:06:09.667+00
8a57da5a-062a-476e-b586-b9e2cf188aaf	289c887e-cfb4-43fc-a296-ddbfa55c7b89	cf2787d8-438d-4325-ab76-9ce35e3b638e	Alex Rivera	2025-07-18 18:06:09.674+00
8f10c7a0-e74b-4d4f-aa51-a99496d2f44e	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	cf2787d8-438d-4325-ab76-9ce35e3b638e	Alex Rivera	2025-04-19 18:06:09.678+00
92a956bb-de99-4af9-8ec6-ea77dd9c7de3	57ea17fe-b039-428f-b107-bb4c5d6403cf	cf2787d8-438d-4325-ab76-9ce35e3b638e	Alex Rivera	2025-10-16 18:06:09.683+00
e9f515b2-58aa-4845-a347-df37da10545a	9dfb8544-6de7-4614-bc6e-6162ec6cea87	cf2787d8-438d-4325-ab76-9ce35e3b638e	Alex Rivera	2025-11-15 18:06:09.687+00
f293595f-2dfc-4a62-a45f-75b06d4f305e	04d130bd-1712-4d8c-b700-2870fcfedf99	cf2787d8-438d-4325-ab76-9ce35e3b638e	Alex Rivera	2025-09-16 18:06:09.692+00
3c373530-834d-4843-971d-d28cbdf0aae9	58dabde6-18c6-4c07-bcd6-057b25356cd0	cf2787d8-438d-4325-ab76-9ce35e3b638e	Alex Rivera	2025-12-15 18:06:09.697+00
3c249a64-1f7f-47b2-8432-e0742a3c29f9	57ea17fe-b039-428f-b107-bb4c5d6403cf	83d0729c-1ad2-4c9f-831d-e2eba4180c34	Sarah Chen	2026-06-13 18:06:09.644809+00
\.


--
-- Data for Name: parts; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.parts (id, listing_id, part_name, compatibility, price, created_at) FROM stdin;
\.


--
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.product_images (id, order_id, return_id, url, kind, created_at, role) FROM stdin;
d9f722cc-27b1-49e8-b81d-004d70e8dfbe	c42d0ba3-d3ea-494f-96a3-83478d0c7b13	23ea20d5-230c-4dac-ba8a-631f4e22b736	/uploads/8feb6988-9284-490d-b622-c8456607199c.jpg	image	2026-06-13 18:07:14.616332+00	item
b4f25770-7e31-47b4-97b8-203664d1aea4	c42d0ba3-d3ea-494f-96a3-83478d0c7b13	23ea20d5-230c-4dac-ba8a-631f4e22b736	/uploads/865b6fb0-0bd8-4f33-9d2d-eb957512bdf5.jpg	image	2026-06-13 18:07:14.651541+00	packaging
4d1f5680-db6a-474a-ab23-a6fbffe655b3	289c887e-cfb4-43fc-a296-ddbfa55c7b89	8486c4b5-933a-4e4b-b867-2082137b85d5	/uploads/e7f6195e-4702-4ff2-b0ad-ef7fe2da7263.jpg	image	2026-06-13 18:08:28.132315+00	item
b476c14a-f666-4aba-b612-569f3c06b010	289c887e-cfb4-43fc-a296-ddbfa55c7b89	8486c4b5-933a-4e4b-b867-2082137b85d5	/uploads/297291ed-8b6a-4f6f-b07f-2a1e06ab8ffd.jpg	image	2026-06-13 18:08:28.149718+00	item
f439e30b-d31d-4cb9-91d3-a57817313aa4	289c887e-cfb4-43fc-a296-ddbfa55c7b89	8486c4b5-933a-4e4b-b867-2082137b85d5	/uploads/c0f8677b-ca43-4f55-8ab3-0e3bffe10d21.jpg	image	2026-06-13 18:08:28.209464+00	packaging
\.


--
-- Data for Name: product_passports; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.product_passports (id, order_id, event_type, detail, actor, created_at) FROM stdin;
ad3cc98d-30dc-441c-9c40-41c4d03d0d55	c42d0ba3-d3ea-494f-96a3-83478d0c7b13	manufactured	{"origin": "Vietnam"}	manufacturer	2026-03-30 18:06:09.667+00
3549e406-2896-4e90-8599-3a958036ac5a	c42d0ba3-d3ea-494f-96a3-83478d0c7b13	first_sale	{"price": 40, "region": "US-WA"}	Amazon	2026-05-14 18:06:09.667+00
a91553e1-a735-47d8-a0f3-df04ba11250b	289c887e-cfb4-43fc-a296-ddbfa55c7b89	manufactured	{"origin": "Vietnam"}	manufacturer	2025-06-03 18:06:09.674+00
558a1eea-cf94-46a6-8246-c78c4af23fa5	289c887e-cfb4-43fc-a296-ddbfa55c7b89	first_sale	{"price": 320, "region": "US-WA"}	Amazon	2025-07-18 18:06:09.674+00
ccfa6b0d-b822-4ec2-a5da-831ae7dc6560	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	manufactured	{"origin": "Vietnam"}	manufacturer	2025-03-05 18:06:09.678+00
17089fca-0f6c-4375-8c8c-4c87551acddb	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	first_sale	{"price": 800, "region": "US-WA"}	Amazon	2025-04-19 18:06:09.678+00
72a9525e-3b0f-48ec-94c9-a306a8188ee0	57ea17fe-b039-428f-b107-bb4c5d6403cf	manufactured	{"origin": "Vietnam"}	manufacturer	2025-09-01 18:06:09.683+00
148a21fd-930e-4b5d-9325-2afefbe3fa94	57ea17fe-b039-428f-b107-bb4c5d6403cf	first_sale	{"price": 130, "region": "US-WA"}	Amazon	2025-10-16 18:06:09.683+00
5d8b6a02-6a53-4ef4-9f9e-ec1fec679bdd	9dfb8544-6de7-4614-bc6e-6162ec6cea87	manufactured	{"origin": "Vietnam"}	manufacturer	2025-10-01 18:06:09.687+00
a563c46f-aa8c-483e-9840-c8f26242d92a	9dfb8544-6de7-4614-bc6e-6162ec6cea87	first_sale	{"price": 180, "region": "US-WA"}	Amazon	2025-11-15 18:06:09.687+00
fafbe1aa-8720-4fe0-8c52-8f66f3a9aaae	04d130bd-1712-4d8c-b700-2870fcfedf99	manufactured	{"origin": "Vietnam"}	manufacturer	2025-08-02 18:06:09.692+00
893f95c8-0b2e-4ea6-b619-b490b84f75c5	04d130bd-1712-4d8c-b700-2870fcfedf99	first_sale	{"price": 290, "region": "US-WA"}	Amazon	2025-09-16 18:06:09.692+00
5d4a3166-140e-40e2-a035-ac9250d97bcd	58dabde6-18c6-4c07-bcd6-057b25356cd0	manufactured	{"origin": "Vietnam"}	manufacturer	2025-10-31 18:06:09.697+00
c2b43b2d-8ea4-491b-9067-7c34dee6a2bc	58dabde6-18c6-4c07-bcd6-057b25356cd0	first_sale	{"price": 350, "region": "US-WA"}	Amazon	2025-12-15 18:06:09.697+00
6db80639-b417-4dca-a245-8d8553ac6a7b	57ea17fe-b039-428f-b107-bb4c5d6403cf	inspection	{"grade": "A", "confidence": 0.94}	Vision AI (qwen/qwen3-vl-8b-instruct)	2026-06-13 18:06:09.644809+00
b91e62d7-f1ca-4db2-bec9-d3b1886534f2	57ea17fe-b039-428f-b107-bb4c5d6403cf	resale	{"price": 88, "route": "zero_warehouse", "carbon_saved_kg": 28.7}	Second Life Commerce	2026-06-13 18:06:09.644809+00
4ca24e0e-5c3f-489f-b88d-3ef5671bca7d	9dfb8544-6de7-4614-bc6e-6162ec6cea87	donation	{"ngo": "Seattle Community Shelter", "people_helped": 2}	Second Life Commerce	2026-06-13 18:06:09.644809+00
3784c50c-e3ee-47e4-9efd-17efdd24f75c	e0aaa5bf-bef3-4b00-9301-19eaaad5ea17	resale	{"via": "ARA_AUTO", "price": 390, "pricing_confidence": 81}	Autonomous Resale Agent	2026-06-13 18:18:16.957098+00
25742841-b763-477c-a0b9-a625b9d16795	58dabde6-18c6-4c07-bcd6-057b25356cd0	resale	{"via": "ARA_AUTO", "price": 178, "pricing_confidence": 89}	Autonomous Resale Agent	2026-06-13 18:18:19.704988+00
3c462723-d582-4c36-975c-a7d92aab868a	04d130bd-1712-4d8c-b700-2870fcfedf99	resale	{"via": "ARA_AUTO", "price": 140, "pricing_confidence": 86}	Autonomous Resale Agent	2026-06-13 18:18:22.136743+00
fb1c9c15-e414-4602-8b59-b8926d093b9b	1c2e39bc-2201-47c7-87be-315fe2f8a9a4	resale	{"via": "ARA_AUTO", "price": 181, "pricing_confidence": 90}	Autonomous Resale Agent	2026-06-13 18:18:24.00103+00
f262df1a-3822-493f-9fc8-1b226f18dec4	0885bc6d-6861-439b-9f75-77646471f11e	resale	{"via": "ARA_AUTO", "price": 183, "pricing_confidence": 90}	Autonomous Resale Agent	2026-06-13 18:18:25.999158+00
a1db6841-8db3-462a-8fc3-e8765f1b69cc	d2fa141d-d59e-4dbd-a096-40557591cb18	resale	{"via": "ARA_AUTO", "price": 74, "pricing_confidence": 90}	Autonomous Resale Agent	2026-06-13 18:18:27.85075+00
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.products (id, title, brand, category, description, msrp, weight_kg, embedded_carbon_kg, monthly_depreciation, eco_score, image_url, created_at, size, listing_quality_score) FROM stdin;
5aeb5030-35f0-4cf3-9895-52a3b59e3eed	Wireless Noise-Cancelling Earbuds	Soundwave	electronics		40.00	0.300	9.000	0.0200	72	https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400	2026-06-13 18:06:09.644809+00	M	85
8faf3c5f-1d97-4f02-957f-18ab101d0589	4K Action Camera	Vantage	electronics		320.00	0.600	78.000	0.0200	64	https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400	2026-06-13 18:06:09.644809+00	M	85
3cefa32d-213b-4f27-9da6-7637fc34824f	Mirrorless Camera Body	Vantage	electronics		800.00	0.700	120.000	0.0200	66	https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400	2026-06-13 18:06:09.644809+00	M	85
5ffcf66f-290c-44ae-8e9b-3f45cfa28ce0	Bluetooth Portable Speaker	Sony	electronics		130.00	0.900	32.000	0.0200	80	https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400	2026-06-13 18:06:09.644809+00	M	85
b5f04b34-cfdb-47fc-b509-04786af26ab5	Down Insulated Jacket	NorthPeak	apparel		180.00	0.800	28.000	0.0120	55	https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400	2026-06-13 18:06:09.644809+00	M	85
bf4f5fd7-b7bb-4943-b436-043472ba34b6	Stand Mixer	HomeChef	home		290.00	5.000	64.000	0.0100	78	https://images.unsplash.com/photo-1578643463396-0997cb5328c1?w=400	2026-06-13 18:06:09.644809+00	M	85
7cda60fa-2742-486e-80e0-026b3ebe5f61	Robot Vacuum	TidyBot	home		350.00	3.500	70.000	0.0120	65	https://images.unsplash.com/photo-1603618304243-ce8c8d6e1f01?w=400	2026-06-13 18:06:09.644809+00	M	85
f3b5c95f-af46-4acf-b6b7-2271a6b0abd2	Running Shoes	Stride	apparel		130.00	0.600	14.000	0.0120	60	https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400	2026-06-13 18:06:09.644809+00	M	85
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.refresh_tokens (id, user_id, token_hash, expires_at, revoked, created_at) FROM stdin;
fc5c92a9-0392-4842-bbaf-c9cdfa5a0665	cf2787d8-438d-4325-ab76-9ce35e3b638e	e04b8f5b37e4dff0a8538a13ee00b3afd0775cce44c83118d7b30982b82a52be	2026-07-13 18:06:13.095+00	f	2026-06-13 18:06:13.097999+00
\.


--
-- Data for Name: rentals; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.rentals (id, listing_id, renter_id, daily_rate, start_date, end_date, deposit, status, created_at) FROM stdin;
\.


--
-- Data for Name: repair_history; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.repair_history (id, order_id, repair_type, parts_replaced, technician, cost, created_at) FROM stdin;
\.


--
-- Data for Name: return_assessments; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.return_assessments (id, return_id, order_id, grade, grade_label, confidence, reasoning, recommended_disposition, packaging_condition, missing_accessories, source, model, product_type, severity, created_at, packaging_grade, packaging_reusable, packaging_recyclability, packaging_waste_score, packaging_recommendation, rde_decision_matrix) FROM stdin;
e486db63-d232-42eb-9585-0be1279fa0ca	380ca609-d29b-43cb-a2fe-72c2302f8b70	57ea17fe-b039-428f-b107-bb4c5d6403cf	A	Excellent	0.940	Pristine condition with minimal surface wear. Fully functional.	resell		[]	vision	qwen/qwen3-vl-8b-instruct		2.00	2026-06-13 18:06:09.644809+00	A	t	96.00	4.00	Reuse Original Packaging	{}
b21136dc-b146-4f37-bf48-31619854e134	23ea20d5-230c-4dac-ba8a-631f4e22b736	c42d0ba3-d3ea-494f-96a3-83478d0c7b13	C	Moderate Damage	0.980	Right earbud is visibly shattered with internal components exposed, indicating severe damage. Left earbud appears intact but the right one renders the product non-functional for resale. Grading as C due to severe damage on one unit.	donate	C	[]	vision	qwen/qwen3-vl-8b-instruct	Soundwave Wireless Noise-Cancelling Earbuds	2.00	2026-06-13 18:07:21.072977+00	C	f	85.00	65.00	Recycle Packaging	{"donate": {"tax_benefit": 9, "impact_score": 96, "carbon_savings": 4.8}, "recycle": {"impact_score": 48, "carbon_savings": 1.5, "waste_reduction": 95}, "resell_as_is": {"profit": 0, "carbon_savings": 5.1, "waste_reduction": 68}, "refurbish_resell": {"profit": 2, "carbon_savings": 5.3, "waste_reduction": 77}}
824b14d3-d314-4ec3-9562-bbe93e08ca59	8486c4b5-933a-4e4b-b867-2082137b85d5	289c887e-cfb4-43fc-a296-ddbfa55c7b89	F	Parts Only	0.980	The camera has a shattered screen and visible water damage, indicating it is beyond repair and not suitable for resale or donation. The packaging is also damaged.	donate	D	[]	vision	qwen/qwen3-vl-8b-instruct	Vantage 4K Action Camera	5.00	2026-06-13 18:08:33.581999+00	D	f	85.00	75.00	Recycle or Dispose	{"donate": {"tax_benefit": 10, "impact_score": 90, "carbon_savings": 5.1}, "recycle": {"impact_score": 48, "carbon_savings": 1.6, "waste_reduction": 95}, "resell_as_is": {"profit": 1, "carbon_savings": 5.4, "waste_reduction": 68}, "refurbish_resell": {"profit": 0, "carbon_savings": 5.7, "waste_reduction": 77}}
\.


--
-- Data for Name: returns; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.returns (id, order_id, user_id, reason_code, reason_text, refund_amount, chosen_path, status, created_at) FROM stdin;
380ca609-d29b-43cb-a2fe-72c2302f8b70	57ea17fe-b039-428f-b107-bb4c5d6403cf	cf2787d8-438d-4325-ab76-9ce35e3b638e	changed_mind		0.00	resell	completed	2026-06-13 18:06:09.644809+00
02600cc3-290c-415a-89b2-b309232af367	9dfb8544-6de7-4614-bc6e-6162ec6cea87	cf2787d8-438d-4325-ab76-9ce35e3b638e	changed_mind		0.00	donate	completed	2026-06-13 18:06:09.644809+00
23ea20d5-230c-4dac-ba8a-631f4e22b736	c42d0ba3-d3ea-494f-96a3-83478d0c7b13	cf2787d8-438d-4325-ab76-9ce35e3b638e	defective		0.00	undecided	analyzed	2026-06-13 18:06:27.969609+00
8486c4b5-933a-4e4b-b867-2082137b85d5	289c887e-cfb4-43fc-a296-ddbfa55c7b89	cf2787d8-438d-4325-ab76-9ce35e3b638e	defective		0.00	undecided	analyzed	2026-06-13 18:07:56.799258+00
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.reviews (id, listing_id, reviewer_id, rating, body, created_at) FROM stdin;
\.


--
-- Data for Name: seller_metrics; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.seller_metrics (seller_id, total_listings, total_sold, return_rate, revenue, circular_score, updated_at) FROM stdin;
49b78060-7bcf-4fdc-9c46-b2216531c7ab	2	0	0.0000	0.00	0	2026-06-13 18:06:09.644809+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.users (id, email, password_hash, name, role, city, zip_code, is_prime, ara_enabled, created_at, updated_at, size_preference, price_sensitivity, sustainability_score) FROM stdin;
cf2787d8-438d-4325-ab76-9ce35e3b638e	alex@example.com	$2a$10$unhh74NrVVngazf91H65teP4QUvADqFoXwpbDLgHsLVUq4vmP/xOm	Alex Rivera	customer	Seattle	98101	t	t	2026-06-13 18:06:09.644809+00	2026-06-13 18:06:09.644809+00	M	medium	75
83d0729c-1ad2-4c9f-831d-e2eba4180c34	sarah@example.com	$2a$10$unhh74NrVVngazf91H65teP4QUvADqFoXwpbDLgHsLVUq4vmP/xOm	Sarah Chen	customer	Austin	98101	t	t	2026-06-13 18:06:09.644809+00	2026-06-13 18:06:09.644809+00	M	medium	75
49b78060-7bcf-4fdc-9c46-b2216531c7ab	jordan@example.com	$2a$10$unhh74NrVVngazf91H65teP4QUvADqFoXwpbDLgHsLVUq4vmP/xOm	Jordan Lee	seller	Portland	98101	t	f	2026-06-13 18:06:09.644809+00	2026-06-13 18:06:09.644809+00	M	medium	75
48952e21-009c-4adb-9b04-1f0590f6c552	esg@example.com	$2a$10$unhh74NrVVngazf91H65teP4QUvADqFoXwpbDLgHsLVUq4vmP/xOm	Enterprise ESG	enterprise	Seattle	98101	t	f	2026-06-13 18:06:09.644809+00	2026-06-13 18:06:09.644809+00	M	medium	75
4c1a7c83-efca-4adf-90ff-5b6e77c0b880	admin@example.com	$2a$10$unhh74NrVVngazf91H65teP4QUvADqFoXwpbDLgHsLVUq4vmP/xOm	Platform Admin	admin	Seattle	98101	t	f	2026-06-13 18:06:09.644809+00	2026-06-13 18:06:09.644809+00	M	medium	75
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.wallets (user_id, green_credits, carbon_saved_kg, water_saved_l, waste_diverted_kg, updated_at, packaging_reused_count, packaging_recycled_count, packaging_waste_diverted_kg, usd_balance) FROM stdin;
83d0729c-1ad2-4c9f-831d-e2eba4180c34	0.00	0.00	0.00	0.00	2026-06-13 18:06:09.644809+00	0	0	0.00	0.00
49b78060-7bcf-4fdc-9c46-b2216531c7ab	0.00	0.00	0.00	0.00	2026-06-13 18:06:09.644809+00	0	0	0.00	0.00
48952e21-009c-4adb-9b04-1f0590f6c552	0.00	0.00	0.00	0.00	2026-06-13 18:06:09.644809+00	0	0	0.00	0.00
4c1a7c83-efca-4adf-90ff-5b6e77c0b880	0.00	0.00	0.00	0.00	2026-06-13 18:06:09.644809+00	0	0	0.00	0.00
cf2787d8-438d-4325-ab76-9ce35e3b638e	6.00	45.50	68.90	0.90	2026-06-13 18:16:19.328138+00	0	0	0.00	5.96
\.


--
-- Data for Name: wishlists; Type: TABLE DATA; Schema: public; Owner: ccos
--

COPY public.wishlists (id, user_id, product_id, created_at) FROM stdin;
\.


--
-- Name: ai_predictions ai_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.ai_predictions
    ADD CONSTRAINT ai_predictions_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: browsing_history browsing_history_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.browsing_history
    ADD CONSTRAINT browsing_history_pkey PRIMARY KEY (id);


--
-- Name: buyer_matches buyer_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.buyer_matches
    ADD CONSTRAINT buyer_matches_pkey PRIMARY KEY (id);


--
-- Name: carbon_events carbon_events_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.carbon_events
    ADD CONSTRAINT carbon_events_pkey PRIMARY KEY (id);


--
-- Name: damage_detections damage_detections_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.damage_detections
    ADD CONSTRAINT damage_detections_pkey PRIMARY KEY (id);


--
-- Name: donations donations_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_pkey PRIMARY KEY (id);


--
-- Name: enterprise_metrics enterprise_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.enterprise_metrics
    ADD CONSTRAINT enterprise_metrics_pkey PRIMARY KEY (id);


--
-- Name: exchanges exchanges_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.exchanges
    ADD CONSTRAINT exchanges_pkey PRIMARY KEY (id);


--
-- Name: fraud_cases fraud_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.fraud_cases
    ADD CONSTRAINT fraud_cases_pkey PRIMARY KEY (id);


--
-- Name: green_credit_transactions green_credit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.green_credit_transactions
    ADD CONSTRAINT green_credit_transactions_pkey PRIMARY KEY (id);


--
-- Name: marketplace_listings marketplace_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.marketplace_listings
    ADD CONSTRAINT marketplace_listings_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: ngos ngos_name_key; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.ngos
    ADD CONSTRAINT ngos_name_key UNIQUE (name);


--
-- Name: ngos ngos_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.ngos
    ADD CONSTRAINT ngos_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: ownership_history ownership_history_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.ownership_history
    ADD CONSTRAINT ownership_history_pkey PRIMARY KEY (id);


--
-- Name: parts parts_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_passports product_passports_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.product_passports
    ADD CONSTRAINT product_passports_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: rentals rentals_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.rentals
    ADD CONSTRAINT rentals_pkey PRIMARY KEY (id);


--
-- Name: repair_history repair_history_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.repair_history
    ADD CONSTRAINT repair_history_pkey PRIMARY KEY (id);


--
-- Name: return_assessments return_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.return_assessments
    ADD CONSTRAINT return_assessments_pkey PRIMARY KEY (id);


--
-- Name: returns returns_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: seller_metrics seller_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.seller_metrics
    ADD CONSTRAINT seller_metrics_pkey PRIMARY KEY (seller_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (user_id);


--
-- Name: wishlists wishlists_pkey; Type: CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_pkey PRIMARY KEY (id);


--
-- Name: idx_ai_module; Type: INDEX; Schema: public; Owner: ccos
--

CREATE INDEX idx_ai_module ON public.ai_predictions USING btree (module);


--
-- Name: idx_carbon_user; Type: INDEX; Schema: public; Owner: ccos
--

CREATE INDEX idx_carbon_user ON public.carbon_events USING btree (user_id);


--
-- Name: idx_gc_user; Type: INDEX; Schema: public; Owner: ccos
--

CREATE INDEX idx_gc_user ON public.green_credit_transactions USING btree (user_id);


--
-- Name: idx_listings_marketplace; Type: INDEX; Schema: public; Owner: ccos
--

CREATE INDEX idx_listings_marketplace ON public.marketplace_listings USING btree (marketplace, status);


--
-- Name: idx_listings_seller; Type: INDEX; Schema: public; Owner: ccos
--

CREATE INDEX idx_listings_seller ON public.marketplace_listings USING btree (seller_id);


--
-- Name: idx_orders_user; Type: INDEX; Schema: public; Owner: ccos
--

CREATE INDEX idx_orders_user ON public.orders USING btree (user_id);


--
-- Name: idx_passport_order; Type: INDEX; Schema: public; Owner: ccos
--

CREATE INDEX idx_passport_order ON public.product_passports USING btree (order_id, created_at);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: ccos
--

CREATE INDEX idx_products_category ON public.products USING btree (category);


--
-- Name: idx_refresh_user; Type: INDEX; Schema: public; Owner: ccos
--

CREATE INDEX idx_refresh_user ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_returns_user; Type: INDEX; Schema: public; Owner: ccos
--

CREATE INDEX idx_returns_user ON public.returns USING btree (user_id);


--
-- Name: ai_predictions ai_predictions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.ai_predictions
    ADD CONSTRAINT ai_predictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: browsing_history browsing_history_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.browsing_history
    ADD CONSTRAINT browsing_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: browsing_history browsing_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.browsing_history
    ADD CONSTRAINT browsing_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: buyer_matches buyer_matches_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.buyer_matches
    ADD CONSTRAINT buyer_matches_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id);


--
-- Name: buyer_matches buyer_matches_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.buyer_matches
    ADD CONSTRAINT buyer_matches_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.marketplace_listings(id) ON DELETE CASCADE;


--
-- Name: buyer_matches buyer_matches_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.buyer_matches
    ADD CONSTRAINT buyer_matches_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: carbon_events carbon_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.carbon_events
    ADD CONSTRAINT carbon_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: carbon_events carbon_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.carbon_events
    ADD CONSTRAINT carbon_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: damage_detections damage_detections_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.damage_detections
    ADD CONSTRAINT damage_detections_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.return_assessments(id) ON DELETE CASCADE;


--
-- Name: donations donations_donor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_donor_id_fkey FOREIGN KEY (donor_id) REFERENCES public.users(id);


--
-- Name: donations donations_ngo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_ngo_id_fkey FOREIGN KEY (ngo_id) REFERENCES public.ngos(id) ON DELETE SET NULL;


--
-- Name: donations donations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.donations
    ADD CONSTRAINT donations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: exchanges exchanges_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.exchanges
    ADD CONSTRAINT exchanges_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.marketplace_listings(id) ON DELETE CASCADE;


--
-- Name: exchanges exchanges_offered_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.exchanges
    ADD CONSTRAINT exchanges_offered_order_id_fkey FOREIGN KEY (offered_order_id) REFERENCES public.orders(id);


--
-- Name: exchanges exchanges_proposer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.exchanges
    ADD CONSTRAINT exchanges_proposer_id_fkey FOREIGN KEY (proposer_id) REFERENCES public.users(id);


--
-- Name: exchanges exchanges_responder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.exchanges
    ADD CONSTRAINT exchanges_responder_id_fkey FOREIGN KEY (responder_id) REFERENCES public.users(id);


--
-- Name: fraud_cases fraud_cases_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.fraud_cases
    ADD CONSTRAINT fraud_cases_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.returns(id) ON DELETE SET NULL;


--
-- Name: fraud_cases fraud_cases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.fraud_cases
    ADD CONSTRAINT fraud_cases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: green_credit_transactions green_credit_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.green_credit_transactions
    ADD CONSTRAINT green_credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: marketplace_listings marketplace_listings_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.marketplace_listings
    ADD CONSTRAINT marketplace_listings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: marketplace_listings marketplace_listings_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.marketplace_listings
    ADD CONSTRAINT marketplace_listings_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: marketplace_listings marketplace_listings_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.marketplace_listings
    ADD CONSTRAINT marketplace_listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.marketplace_listings(id) ON DELETE CASCADE;


--
-- Name: messages messages_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id);


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: orders orders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ownership_history ownership_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.ownership_history
    ADD CONSTRAINT ownership_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: ownership_history ownership_history_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.ownership_history
    ADD CONSTRAINT ownership_history_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: parts parts_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.marketplace_listings(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: product_passports product_passports_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.product_passports
    ADD CONSTRAINT product_passports_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: rentals rentals_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.rentals
    ADD CONSTRAINT rentals_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.marketplace_listings(id) ON DELETE CASCADE;


--
-- Name: rentals rentals_renter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.rentals
    ADD CONSTRAINT rentals_renter_id_fkey FOREIGN KEY (renter_id) REFERENCES public.users(id);


--
-- Name: repair_history repair_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.repair_history
    ADD CONSTRAINT repair_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: return_assessments return_assessments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.return_assessments
    ADD CONSTRAINT return_assessments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: return_assessments return_assessments_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.return_assessments
    ADD CONSTRAINT return_assessments_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.returns(id) ON DELETE CASCADE;


--
-- Name: returns returns_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: returns returns_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.marketplace_listings(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id);


--
-- Name: seller_metrics seller_metrics_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.seller_metrics
    ADD CONSTRAINT seller_metrics_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wishlists wishlists_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: wishlists wishlists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ccos
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: ccos
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict nZVRSje0ge23otndX963W78PdPs1BTkSHXNm6iNEeXHj1IsHsbgdaMHGkTagtoe

