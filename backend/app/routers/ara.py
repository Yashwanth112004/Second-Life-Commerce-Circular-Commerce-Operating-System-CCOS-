"""Autonomous Resale Agent (ARA) — the Secret Weapon endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import ARAResponse
from ..services.ara_agent import scan_inventory

router = APIRouter(prefix="/api/ara", tags=["ara"])


@router.post("/scan", response_model=ARAResponse)
def scan(db: Session = Depends(get_db)) -> ARAResponse:
    user = db.query(User).filter(User.email == "alex@example.com").first()
    if not user:
        raise HTTPException(404, "Demo user not found. Run `python -m app.seed`.")
    plan = scan_inventory(db, user)
    return ARAResponse(
        user_name=plan.user_name,
        candidate_count=plan.candidate_count,
        total_resale_value=plan.total_resale_value,
        total_projected_carbon_kg=plan.total_projected_carbon_kg,
        total_projected_gc=plan.total_projected_gc,
        headline=plan.headline,
        candidates=plan.candidates,
    )
