"""Next Best Owner Engine (NBOE) — Module 3.

Given a returned/listed item, find the ideal next buyers. In production this is a
two-tower neural retrieval model (item encoder + buyer encoder) over the live buyer
database with ANN search. For the hackathon we generate a deterministic, plausible
candidate pool near the seller so the demo always surfaces "3 buyers near you who
want exactly this item" — with explainable match scores.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

_FIRST = ["Maria", "James", "Elena", "Dev", "Aisha", "Liam", "Noah", "Priya", "Sofia", "Kenji"]
_NEIGHBORHOODS = {
    "Seattle": ["Capitol Hill", "Ballard", "Fremont", "Queen Anne"],
    "Austin": ["South Congress", "Mueller", "Hyde Park", "Zilker"],
    "Chicago": ["Wicker Park", "Logan Square", "Lincoln Park", "Pilsen"],
    "default": ["Downtown", "Midtown", "Riverside", "Old Town"],
}


@dataclass
class BuyerMatch:
    buyer_name: str
    location: str
    distance_miles: float
    match_score: int
    price_fit: str
    outreach_message: str
    predicted_days_to_sale: int


@dataclass
class MatchResult:
    matches: list[BuyerMatch] = field(default_factory=list)
    pool_size: int = 0
    routing: str = "zero_warehouse"


def find_buyers(
    *,
    item_id: str,
    product_title: str,
    category: str,
    price: float,
    seller_city: str,
    limit: int = 3,
) -> MatchResult:
    seed = f"{item_id}:{category}:{seller_city}"
    h = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    hoods = _NEIGHBORHOODS.get(seller_city, _NEIGHBORHOODS["default"])

    matches: list[BuyerMatch] = []
    for i in range(limit):
        salt = (h >> (i * 8)) & 0xFFFFFF
        name = _FIRST[salt % len(_FIRST)]
        hood = hoods[salt % len(hoods)]
        distance = round(2 + (salt % 38) + (salt % 10) / 10, 1)
        score = 96 - i * 6 - (salt % 4)  # ranked, descending
        # Closer + higher score => faster predicted sale.
        days = max(2, int(distance / 6) + i + 1)
        budget_delta = (salt % 25) - 8
        if budget_delta >= 0:
            price_fit = f"budget ~${price + budget_delta:.0f} (above ask)"
        else:
            price_fit = f"budget ~${price + budget_delta:.0f} (at ask)"
        msg = (
            f"Hi {name} — a Certified Preloved {product_title} just became available "
            f"{distance:.0f} mi from you in {hood}, matching your saved search. "
            f"Listed at ${price:.0f}."
        )
        matches.append(
            BuyerMatch(
                buyer_name=name,
                location=f"{hood}, {seller_city}",
                distance_miles=distance,
                match_score=score,
                price_fit=price_fit,
                outreach_message=msg,
                predicted_days_to_sale=days,
            )
        )

    matches.sort(key=lambda m: m.match_score, reverse=True)
    # Closest high-scoring match within ~50 mi unlocks zero-warehouse routing.
    routing = "zero_warehouse" if matches and matches[0].distance_miles <= 50 else "regional_warehouse"
    return MatchResult(matches=matches, pool_size=120 + (h % 400), routing=routing)
