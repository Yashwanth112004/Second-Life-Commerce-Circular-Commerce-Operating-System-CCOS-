"""Autonomous Resale Agent (ARA) — Module 30 / Section 20 (the Secret Weapon).

Scans a customer's owned inventory, identifies items with latent resale value,
and produces a prioritized, autonomous resale plan: timing, price, listing, and
projected proceeds + impact. This is the headline "your closet is a passive income
engine" demo.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field

from sqlalchemy.orm import Session

from ..models import OwnedItem, Product, User
from . import cv_assessment, pricing
from .carbon import calculate_carbon

# Categories with enough secondary-market liquidity for the ARA to act on.
LIQUID_CATEGORIES = {"electronics", "apparel", "home"}

# Peak resale seasonality hint by category (drives the timing recommendation).
PEAK_SEASON = {
    "electronics": "now (pre-holiday demand is climbing)",
    "apparel": "this month (seasonal turnover)",
    "home": "next 2 weeks (steady demand)",
}


@dataclass
class ARACandidate:
    item_id: str
    product_title: str
    category: str
    age_months: int
    grade: str
    estimated_price: float
    optimal_timing: str
    projected_carbon_kg: float
    projected_gc: int
    priority: int


@dataclass
class ARAPlan:
    user_name: str
    candidate_count: int
    total_resale_value: float
    total_projected_carbon_kg: float
    total_projected_gc: int
    candidates: list[dict] = field(default_factory=list)
    headline: str = ""


def scan_inventory(db: Session, user: User, *, min_price: float = 30.0, min_age_months: int = 6) -> ARAPlan:
    items = (
        db.query(OwnedItem)
        .filter(OwnedItem.owner_id == user.id, OwnedItem.status == "owned")
        .all()
    )

    candidates: list[ARACandidate] = []
    for item in items:
        product: Product = item.product
        if product.category not in LIQUID_CATEGORIES:
            continue
        if item.purchase_price < min_price or item.age_months < min_age_months:
            continue

        assessment = cv_assessment.assess_condition(
            category=product.category, photo_refs=[], item_id=item.id
        )
        price = pricing.recommend_price(
            msrp=product.msrp,
            grade=assessment.grade,
            age_months=item.age_months,
            category=product.category,
        )
        carbon = calculate_carbon(
            embedded_carbon_kg=product.embedded_carbon_kg,
            weight_kg=product.weight_kg,
            grade=assessment.grade,
            route="zero_warehouse",
        )
        from .green_credits import credits_for_action

        gc = credits_for_action("resale", carbon.carbon_saved_kg)

        candidates.append(
            ARACandidate(
                item_id=item.id,
                product_title=product.title,
                category=product.category,
                age_months=item.age_months,
                grade=assessment.grade,
                estimated_price=price.recommended_price,
                optimal_timing=PEAK_SEASON.get(product.category, "this month"),
                projected_carbon_kg=carbon.carbon_saved_kg,
                projected_gc=gc,
                priority=0,
            )
        )

    # Prioritize by estimated proceeds (highest-value items first).
    candidates.sort(key=lambda c: c.estimated_price, reverse=True)
    for i, c in enumerate(candidates, start=1):
        c.priority = i

    total_value = round(sum(c.estimated_price for c in candidates), 0)
    total_carbon = round(sum(c.projected_carbon_kg for c in candidates), 1)
    total_gc = sum(c.projected_gc for c in candidates)

    headline = (
        f"I found {len(candidates)} items in your purchase history with an estimated "
        f"total resale value of ${total_value:,.0f}. Want me to start selling?"
    )

    return ARAPlan(
        user_name=user.name,
        candidate_count=len(candidates),
        total_resale_value=total_value,
        total_projected_carbon_kg=total_carbon,
        total_projected_gc=total_gc,
        candidates=[asdict(c) for c in candidates],
        headline=headline,
    )
