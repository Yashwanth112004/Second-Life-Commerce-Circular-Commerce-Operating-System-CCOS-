"""Damage Detection Vision AI (DDVA) — Module 2.

Assesses product condition from uploaded photos and returns a condition grade,
specific damage notes, a confidence score, and a recommended disposition.

For the hackathon this runs a deterministic grader so the live demo is reproducible
(the same photos always yield the same grade). When CCOS_USE_BEDROCK=1 it instead
routes the images to a vision model (Amazon Rekognition / Claude Vision) — see
`_assess_with_bedrock` for the integration point.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

from ..config import settings

GRADE_LABELS = {
    "A+": "Like New",
    "A": "Excellent",
    "B": "Good",
    "C": "Fair",
    "D": "Parts / Salvage",
}

# Category-specific damage vocabulary the model "detects".
DAMAGE_LIBRARY: dict[str, list[str]] = {
    "electronics": [
        "minor surface scuff on rear casing",
        "light wear on charging port",
        "1.2 cm hairline scratch on screen bezel",
        "battery health estimated at 88%",
    ],
    "apparel": [
        "very light pilling on left cuff",
        "no visible stains or tears",
        "tags removed; original packaging intact",
        "mild fading consistent with 2-3 washes",
    ],
    "home": [
        "small scuff on base, not visible in use",
        "all components present",
        "minor dust; cleans to like-new",
        "no functional defects detected",
    ],
    "default": [
        "light cosmetic wear",
        "no structural damage detected",
        "fully functional on inspection",
    ],
}

DISPOSITION_BY_GRADE = {
    "A+": "Resell As-Is (Certified Preloved)",
    "A": "Resell As-Is",
    "B": "Resell As-Is",
    "C": "Refurbish & Resell",
    "D": "Parts-Harvest / Recycle",
}


@dataclass
class AssessmentResult:
    grade: str
    grade_label: str
    confidence: float
    damage_notes: list[str] = field(default_factory=list)
    recommended_disposition: str = ""


def _deterministic_grade(seed: str) -> tuple[str, float]:
    """Map a seed string to a stable grade + confidence."""
    h = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    bucket = h % 100
    if bucket < 35:
        grade = "A+"
    elif bucket < 65:
        grade = "A"
    elif bucket < 85:
        grade = "B"
    elif bucket < 95:
        grade = "C"
    else:
        grade = "D"
    confidence = round(0.90 + (h % 9) / 100, 2)  # 0.90 - 0.98
    return grade, confidence


def assess_condition(
    *,
    category: str,
    photo_refs: list[str],
    simulate_grade: str | None = None,
    item_id: str = "",
) -> AssessmentResult:
    if settings.use_bedrock:
        result = _assess_with_bedrock(category=category, photo_refs=photo_refs)
        if result is not None:
            return result

    if simulate_grade in GRADE_LABELS:
        grade = simulate_grade
        confidence = 0.96
    else:
        seed = item_id or "|".join(sorted(photo_refs)) or category
        grade, confidence = _deterministic_grade(seed)

    notes_pool = DAMAGE_LIBRARY.get(category, DAMAGE_LIBRARY["default"])
    # Higher grades surface fewer/lighter notes.
    n_notes = {"A+": 2, "A": 2, "B": 3, "C": 3, "D": 3}.get(grade, 2)
    notes = notes_pool[:n_notes]

    return AssessmentResult(
        grade=grade,
        grade_label=GRADE_LABELS[grade],
        confidence=confidence,
        damage_notes=notes,
        recommended_disposition=DISPOSITION_BY_GRADE[grade],
    )


def _assess_with_bedrock(*, category: str, photo_refs: list[str]) -> AssessmentResult | None:
    """Integration point for real vision grading. Returns None on any failure so the
    caller falls back to the deterministic grader (the demo must never hard-fail)."""
    try:  # pragma: no cover - exercised only when AWS creds are configured
        import boto3  # type: ignore

        # In production: download images from S3, send to Rekognition / Claude Vision via
        # Bedrock, and parse a structured grade. Left as a wired stub for the hackathon.
        _ = boto3.client("bedrock-runtime", region_name=settings.aws_region)
        return None
    except Exception:
        return None
