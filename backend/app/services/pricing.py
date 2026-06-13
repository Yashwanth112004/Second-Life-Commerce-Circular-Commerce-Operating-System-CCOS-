"""Dynamic Circular Pricing Engine (DCPE) — Module 5.

Recommends a resale price for a returned/owned item from its MSRP, condition grade,
age, and category demand. Returns a price plus a floor/ceiling band and a markdown
schedule the Autonomous Resale Agent uses for active price management.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# Resale value retained as a fraction of MSRP, by condition grade.
GRADE_RETENTION: dict[str, float] = {
    "A+": 0.78,
    "A": 0.68,
    "B": 0.55,
    "C": 0.38,
    "D": 0.18,
}

# Monthly depreciation by category (how fast resale value decays with age).
CATEGORY_DEPRECIATION: dict[str, float] = {
    "electronics": 0.020,
    "apparel": 0.012,
    "home": 0.010,
    "default": 0.015,
}

# Demand multiplier — categories with hotter secondary markets price higher.
DEMAND_MULTIPLIER: dict[str, float] = {
    "electronics": 1.08,
    "apparel": 1.02,
    "home": 0.98,
    "default": 1.0,
}


@dataclass
class PriceResult:
    recommended_price: float
    floor: float
    ceiling: float
    markdown_schedule: list[dict] = field(default_factory=list)
    rationale: str = ""


def recommend_price(
    *, msrp: float, grade: str, age_months: int, category: str
) -> PriceResult:
    retention = GRADE_RETENTION.get(grade, 0.5)
    monthly_dep = CATEGORY_DEPRECIATION.get(category, CATEGORY_DEPRECIATION["default"])
    demand = DEMAND_MULTIPLIER.get(category, 1.0)

    age_factor = max(1.0 - monthly_dep * age_months, 0.25)
    base = msrp * retention * age_factor * demand

    recommended = round(base, 0)
    floor = round(base * 0.80, 0)
    ceiling = round(base * 1.12, 0)

    # Price-decay schedule (markdown triggers) for the ARA's active price management.
    schedule = [
        {"day": 0, "price": recommended},
        {"day": 7, "price": round(recommended * 0.95, 0)},
        {"day": 14, "price": round(recommended * 0.88, 0)},
        {"day": 21, "price": floor},
    ]

    rationale = (
        f"{int(retention * 100)}% MSRP retention for grade {grade}, "
        f"{int((1 - age_factor) * 100)}% age depreciation over {age_months} mo, "
        f"{category} demand x{demand:.2f}."
    )
    return PriceResult(recommended, floor, ceiling, schedule, rationale)
