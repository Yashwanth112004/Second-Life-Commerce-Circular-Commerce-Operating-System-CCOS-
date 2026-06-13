"""Pydantic request/response schemas for the CCOS API."""
from __future__ import annotations

from pydantic import BaseModel, Field


# ---- shared ----
class UserOut(BaseModel):
    id: str
    name: str
    city: str
    is_prime: bool
    green_credits: float
    carbon_saved_kg: float
    level: str = "Seedling"


class ProductOut(BaseModel):
    id: str
    title: str
    brand: str
    category: str
    msrp: float
    image_url: str
    eco_score: int


class OwnedItemOut(BaseModel):
    id: str
    product: ProductOut
    purchase_price: float
    age_months: int
    status: str


# ---- condition assessment (DDVA) ----
class AssessRequest(BaseModel):
    item_id: str
    photo_refs: list[str] = Field(default_factory=list)
    simulate_grade: str | None = None


class AssessResponse(BaseModel):
    item_id: str
    grade: str
    grade_label: str
    confidence: float
    damage_notes: list[str]
    recommended_disposition: str


# ---- return wizard ----
class ReturnInitiateRequest(BaseModel):
    item_id: str
    reason_code: str = "changed_mind"
    reason_text: str = ""


class ResaleOffer(BaseModel):
    refund_amount: float
    resale_price: float
    resale_net_to_seller: float
    uplift: float
    recommendation: str


class ReturnInitiateResponse(BaseModel):
    return_id: str
    item: OwnedItemOut
    assessment: AssessResponse
    offer: ResaleOffer


# ---- listing (LAG) ----
class GenerateListingRequest(BaseModel):
    item_id: str


class ListingOut(BaseModel):
    id: str | None = None
    title: str
    description: str
    price: float
    condition_grade: str
    highlights: list[str]
    keywords: list[str]
    condition_disclosure: str


# ---- carbon (CFCA) ----
class CarbonRequest(BaseModel):
    item_id: str
    grade: str = "A"
    route: str = "zero_warehouse"
    action: str = "resale"


class CarbonResponse(BaseModel):
    carbon_saved_kg: float
    water_saved_l: float
    waste_diverted_kg: float
    avoided_manufacturing_kg: float
    avoided_double_shipping_kg: float
    circular_logistics_kg: float
    equivalents: dict[str, str]


# ---- next best owner (NBOE) ----
class MatchRequest(BaseModel):
    item_id: str
    price: float | None = None


class BuyerMatchOut(BaseModel):
    buyer_name: str
    location: str
    distance_miles: float
    match_score: int
    price_fit: str
    outreach_message: str
    predicted_days_to_sale: int


class MatchResponse(BaseModel):
    item_id: str
    pool_size: int
    routing: str
    matches: list[BuyerMatchOut]


# ---- resell action (commits the whole flow) ----
class ResellRequest(BaseModel):
    return_id: str
    route: str = "zero_warehouse"


class ResellResponse(BaseModel):
    listing: ListingOut
    carbon: CarbonResponse
    green_credits_earned: int
    new_gc_balance: float
    matches: MatchResponse


# ---- green credits / sustainability ----
class LedgerEntryOut(BaseModel):
    delta: float
    reason: str
    balance_after: float
    created_at: str


class SustainabilityDashboard(BaseModel):
    user: UserOut
    total_carbon_saved_kg: float
    total_green_credits: float
    level: str
    next_level: str | None
    gc_to_next_level: float
    ledger: list[LedgerEntryOut]
    equivalents: dict[str, str]


# ---- passport ----
class PassportEventOut(BaseModel):
    event_type: str
    detail: dict
    actor: str
    created_at: str


class PassportOut(BaseModel):
    item_id: str
    product: ProductOut
    current_grade: str | None
    events: list[PassportEventOut]


# ---- ARA ----
class ARAResponse(BaseModel):
    user_name: str
    candidate_count: int
    total_resale_value: float
    total_projected_carbon_kg: float
    total_projected_gc: int
    headline: str
    candidates: list[dict]
