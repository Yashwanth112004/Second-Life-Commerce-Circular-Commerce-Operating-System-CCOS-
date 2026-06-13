"""Sustainability dashboard + Green Credits wallet."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import GreenCreditLedger, User
from ..schemas import LedgerEntryOut, SustainabilityDashboard
from ..serializers import user_out
from ..services.carbon import _equivalents
from ..services.green_credits import CARBON_WARRIOR_LEVELS, level_for_balance

router = APIRouter(prefix="/api/sustainability", tags=["sustainability"])


def _next_level(total_gc: float) -> tuple[str | None, float]:
    for threshold, name in CARBON_WARRIOR_LEVELS:
        if total_gc < threshold:
            return name, round(threshold - total_gc, 1)
    return None, 0.0


@router.get("/dashboard", response_model=SustainabilityDashboard)
def dashboard(db: Session = Depends(get_db)) -> SustainabilityDashboard:
    user = db.query(User).filter(User.email == "alex@example.com").first()
    if not user:
        raise HTTPException(404, "Demo user not found. Run `python -m app.seed`.")

    ledger_rows = (
        db.query(GreenCreditLedger)
        .filter(GreenCreditLedger.user_id == user.id)
        .order_by(GreenCreditLedger.created_at.desc())
        .limit(20)
        .all()
    )
    next_name, gc_to_next = _next_level(user.green_credits)

    return SustainabilityDashboard(
        user=user_out(user),
        total_carbon_saved_kg=round(user.carbon_saved_kg, 2),
        total_green_credits=round(user.green_credits, 2),
        level=level_for_balance(user.green_credits),
        next_level=next_name,
        gc_to_next_level=gc_to_next,
        ledger=[
            LedgerEntryOut(
                delta=r.delta, reason=r.reason, balance_after=r.balance_after,
                created_at=r.created_at.isoformat(),
            )
            for r in ledger_rows
        ],
        equivalents=_equivalents(user.carbon_saved_kg),
    )
