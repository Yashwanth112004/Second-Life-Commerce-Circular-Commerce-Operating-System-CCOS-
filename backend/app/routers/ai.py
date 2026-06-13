"""AI service endpoints: condition assessment, listing generation, carbon, buyer matching."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ConditionAssessment, OwnedItem
from ..schemas import (
    AssessRequest,
    AssessResponse,
    CarbonRequest,
    CarbonResponse,
    GenerateListingRequest,
    ListingOut,
    MatchRequest,
    MatchResponse,
)
from ..services import cv_assessment, listing_generator, next_best_owner, pricing
from ..services.carbon import calculate_carbon

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _get_item(db: Session, item_id: str) -> OwnedItem:
    item = db.get(OwnedItem, item_id)
    if not item:
        raise HTTPException(404, f"Item {item_id} not found")
    return item


def _latest_grade(db: Session, item_id: str) -> str:
    a = (
        db.query(ConditionAssessment)
        .filter(ConditionAssessment.item_id == item_id)
        .order_by(ConditionAssessment.created_at.desc())
        .first()
    )
    return a.grade if a else "A"


@router.post("/assess-condition", response_model=AssessResponse)
def assess_condition(req: AssessRequest, db: Session = Depends(get_db)) -> AssessResponse:
    item = _get_item(db, req.item_id)
    result = cv_assessment.assess_condition(
        category=item.product.category,
        photo_refs=req.photo_refs,
        simulate_grade=req.simulate_grade,
        item_id=item.id,
    )
    db.add(ConditionAssessment(
        item_id=item.id, grade=result.grade, grade_label=result.grade_label,
        confidence=result.confidence, damage_notes=result.damage_notes,
        recommended_disposition=result.recommended_disposition,
    ))
    db.commit()
    return AssessResponse(item_id=item.id, **result.__dict__)


@router.post("/generate-listing", response_model=ListingOut)
def generate_listing(req: GenerateListingRequest, db: Session = Depends(get_db)) -> ListingOut:
    item = _get_item(db, req.item_id)
    grade = _latest_grade(db, item.id)
    assess = cv_assessment.assess_condition(
        category=item.product.category, photo_refs=[], simulate_grade=grade, item_id=item.id
    )
    price = pricing.recommend_price(
        msrp=item.product.msrp, grade=grade,
        age_months=item.age_months, category=item.product.category,
    )
    listing = listing_generator.generate_listing(
        product_title=item.product.title, brand=item.product.brand,
        category=item.product.category, grade=grade, grade_label=assess.grade_label,
        damage_notes=assess.damage_notes, price=price.recommended_price,
        age_months=item.age_months,
    )
    return ListingOut(
        title=listing.title, description=listing.description,
        price=price.recommended_price, condition_grade=grade,
        highlights=listing.highlights, keywords=listing.keywords,
        condition_disclosure=listing.condition_disclosure,
    )


@router.post("/calculate-carbon", response_model=CarbonResponse)
def calculate_carbon_endpoint(req: CarbonRequest, db: Session = Depends(get_db)) -> CarbonResponse:
    item = _get_item(db, req.item_id)
    grade = req.grade or _latest_grade(db, item.id)
    result = calculate_carbon(
        embedded_carbon_kg=item.product.embedded_carbon_kg,
        weight_kg=item.product.weight_kg,
        grade=grade, route=req.route, action=req.action,
    )
    return CarbonResponse(**result.__dict__)


@router.post("/match-buyer", response_model=MatchResponse)
def match_buyer(req: MatchRequest, db: Session = Depends(get_db)) -> MatchResponse:
    item = _get_item(db, req.item_id)
    grade = _latest_grade(db, item.id)
    price = req.price or pricing.recommend_price(
        msrp=item.product.msrp, grade=grade,
        age_months=item.age_months, category=item.product.category,
    ).recommended_price
    result = next_best_owner.find_buyers(
        item_id=item.id, product_title=item.product.title,
        category=item.product.category, price=price,
        seller_city=item.owner.city,
    )
    return MatchResponse(
        item_id=item.id, pool_size=result.pool_size, routing=result.routing,
        matches=[m.__dict__ for m in result.matches],
    )
