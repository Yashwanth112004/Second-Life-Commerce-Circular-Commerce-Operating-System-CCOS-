"""Green Credits economy (Section 9).

1 Green Credit (GC) == 1 kg CO2e prevented (verified via LCA). The number of credits an
action earns is the carbon it saved, clamped to the per-action band from the blueprint.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import GreenCreditLedger, User

# (min, max) GC band per circular action — Section 9 "Earning Green Credits".
ACTION_BANDS: dict[str, tuple[int, int]] = {
    "resale": (5, 50),
    "list": (2, 10),
    "buy_preloved": (10, 80),
    "donation": (5, 30),
    "repair": (15, 100),
    "rental": (3, 20),
}

CARBON_WARRIOR_LEVELS = [
    (0, "Seedling"),
    (101, "Sprout"),
    (501, "Sapling"),
    (2001, "Tree"),
    (10001, "Forest"),
    (50001, "Ecosystem Guardian"),
]


def credits_for_action(action: str, carbon_saved_kg: float) -> int:
    lo, hi = ACTION_BANDS.get(action, (1, 50))
    return int(max(lo, min(hi, round(carbon_saved_kg))))


def level_for_balance(total_gc: float) -> str:
    level = CARBON_WARRIOR_LEVELS[0][1]
    for threshold, name in CARBON_WARRIOR_LEVELS:
        if total_gc >= threshold:
            level = name
    return level


def award_credits(db: Session, *, user: User, amount: float, reason: str) -> GreenCreditLedger:
    user.green_credits = round(user.green_credits + amount, 2)
    entry = GreenCreditLedger(
        user_id=user.id,
        delta=amount,
        reason=reason,
        balance_after=user.green_credits,
    )
    db.add(entry)
    return entry
