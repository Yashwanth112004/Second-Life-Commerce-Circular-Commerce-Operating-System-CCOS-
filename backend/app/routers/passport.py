"""Digital Product Passport (DPP) — the full lifecycle record of an item."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ConditionAssessment, OwnedItem, PassportEvent
from ..schemas import PassportEventOut, PassportOut
from ..serializers import product_out

router = APIRouter(prefix="/api/passport", tags=["passport"])


@router.get("/{item_id}", response_model=PassportOut)
def get_passport(item_id: str, db: Session = Depends(get_db)) -> PassportOut:
    item = db.get(OwnedItem, item_id)
    if not item:
        raise HTTPException(404, f"Item {item_id} not found")

    events = (
        db.query(PassportEvent)
        .filter(PassportEvent.item_id == item_id)
        .order_by(PassportEvent.created_at.asc())
        .all()
    )
    grade = (
        db.query(ConditionAssessment)
        .filter(ConditionAssessment.item_id == item_id)
        .order_by(ConditionAssessment.created_at.desc())
        .first()
    )
    return PassportOut(
        item_id=item_id,
        product=product_out(item.product),
        current_grade=grade.grade if grade else None,
        events=[
            PassportEventOut(
                event_type=e.event_type, detail=e.detail, actor=e.actor,
                created_at=e.created_at.isoformat(),
            )
            for e in events
        ],
    )
