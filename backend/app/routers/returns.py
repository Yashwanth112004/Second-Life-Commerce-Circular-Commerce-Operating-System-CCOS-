"""The Smart Return Wizard — the core judge-demo flow."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import (
    CarbonRecord,
    ConditionAssessment,
    OwnedItem,
    PassportEvent,
    ResaleListing,
    ReturnRequest,
)
from ..schemas import (
    AssessResponse,
    CarbonResponse,
    ListingOut,
    MatchResponse,
    ResaleOffer,
    ResellRequest,
    ResellResponse,
    ReturnInitiateRequest,
    ReturnInitiateResponse,
)
from ..serializers import item_out
from ..services import cv_assessment, listing_generator, next_best_owner, pricing
from ..services.carbon import calculate_carbon
from ..services.green_credits import award_credits, credits_for_action

router = APIRouter(prefix="/api/returns", tags=["returns"])

COMMISSION_RATE = 0.10  # circular transaction fee


@router.post("/initiate", response_model=ReturnInitiateResponse)
def initiate(req: ReturnInitiateRequest, db: Session = Depends(get_db)) -> ReturnInitiateResponse:
    item = db.get(OwnedItem, req.item_id)
    if not item:
        raise HTTPException(404, f"Item {req.item_id} not found")

    # 1) Vision condition assessment (DDVA)
    assess = cv_assessment.assess_condition(
        category=item.product.category, photo_refs=[], item_id=item.id
    )
    db.add(ConditionAssessment(
        item_id=item.id, grade=assess.grade, grade_label=assess.grade_label,
        confidence=assess.confidence, damage_notes=assess.damage_notes,
        recommended_disposition=assess.recommended_disposition,
    ))

    # 2) Resale offer vs. standard refund (DCPE)
    price = pricing.recommend_price(
        msrp=item.product.msrp, grade=assess.grade,
        age_months=item.age_months, category=item.product.category,
    )
    refund = round(item.purchase_price, 2)
    resale_net = round(price.recommended_price * (1 - COMMISSION_RATE), 2)
    uplift = round(resale_net - refund, 2)
    recommendation = (
        "resell" if uplift > 0 else "refund"
    )

    rr = ReturnRequest(
        item_id=item.id, user_id=item.owner_id,
        reason_code=req.reason_code, reason_text=req.reason_text,
        refund_amount=refund, chosen_path="undecided",
    )
    db.add(rr)
    item.status = "return_initiated"
    db.commit()
    db.refresh(rr)

    return ReturnInitiateResponse(
        return_id=rr.id,
        item=item_out(item),
        assessment=AssessResponse(item_id=item.id, **assess.__dict__),
        offer=ResaleOffer(
            refund_amount=refund,
            resale_price=price.recommended_price,
            resale_net_to_seller=resale_net,
            uplift=uplift,
            recommendation=recommendation,
        ),
    )


@router.post("/resell", response_model=ResellResponse)
def resell(req: ResellRequest, db: Session = Depends(get_db)) -> ResellResponse:
    rr = db.get(ReturnRequest, req.return_id)
    if not rr:
        raise HTTPException(404, f"Return {req.return_id} not found")
    item = db.get(OwnedItem, rr.item_id)
    user = item.owner

    grade = (
        db.query(ConditionAssessment)
        .filter(ConditionAssessment.item_id == item.id)
        .order_by(ConditionAssessment.created_at.desc())
        .first()
    )
    grade_code = grade.grade if grade else "A"
    grade_label = grade.grade_label if grade else "Excellent"
    notes = grade.damage_notes if grade else []

    price = pricing.recommend_price(
        msrp=item.product.msrp, grade=grade_code,
        age_months=item.age_months, category=item.product.category,
    )

    # 3) GenAI listing (LAG)
    gen = listing_generator.generate_listing(
        product_title=item.product.title, brand=item.product.brand,
        category=item.product.category, grade=grade_code, grade_label=grade_label,
        damage_notes=notes, price=price.recommended_price, age_months=item.age_months,
    )
    listing = ResaleListing(
        item_id=item.id, seller_id=user.id, title=gen.title,
        description=gen.description, price=price.recommended_price,
        condition_grade=grade_code, keywords=gen.keywords,
    )
    db.add(listing)

    # 4) Carbon (CFCA)
    carbon = calculate_carbon(
        embedded_carbon_kg=item.product.embedded_carbon_kg,
        weight_kg=item.product.weight_kg, grade=grade_code,
        route=req.route, action="resale",
    )
    db.add(CarbonRecord(
        user_id=user.id, item_id=item.id, action="resale",
        carbon_saved_kg=carbon.carbon_saved_kg, water_saved_l=carbon.water_saved_l,
        waste_diverted_kg=carbon.waste_diverted_kg,
    ))
    user.carbon_saved_kg = round(user.carbon_saved_kg + carbon.carbon_saved_kg, 2)

    # 5) Green Credits
    gc = credits_for_action("resale", carbon.carbon_saved_kg)
    award_credits(db, user=user, amount=gc, reason=f"Resold {item.product.title} instead of returning")

    # 6) Next Best Owner (NBOE)
    match = next_best_owner.find_buyers(
        item_id=item.id, product_title=item.product.title,
        category=item.product.category, price=price.recommended_price,
        seller_city=user.city,
    )

    # 7) Passport events
    db.add(PassportEvent(
        item_id=item.id, event_type="inspection", actor="DDVA (AI)",
        detail={"grade": grade_code, "method": "computer_vision"},
    ))
    db.add(PassportEvent(
        item_id=item.id, event_type="resale", actor="Second Life Commerce",
        detail={"price": price.recommended_price, "route": req.route,
                "carbon_saved_kg": carbon.carbon_saved_kg},
    ))

    rr.chosen_path = "resell"
    item.status = "listed"
    db.commit()
    db.refresh(listing)

    return ResellResponse(
        listing=ListingOut(
            id=listing.id, title=listing.title, description=listing.description,
            price=listing.price, condition_grade=grade_code,
            highlights=gen.highlights, keywords=gen.keywords,
            condition_disclosure=gen.condition_disclosure,
        ),
        carbon=CarbonResponse(**carbon.__dict__),
        green_credits_earned=gc,
        new_gc_balance=user.green_credits,
        matches=MatchResponse(
            item_id=item.id, pool_size=match.pool_size, routing=match.routing,
            matches=[m.__dict__ for m in match.matches],
        ),
    )
