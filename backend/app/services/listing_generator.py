"""Listing Auto-Generator (LAG) — Module 11.

Turns item data + condition assessment into a complete, compelling resale listing:
title, description, key highlights, condition disclosure, and SEO keywords.

Deterministic by default (template + assessment-driven copy). With CCOS_USE_BEDROCK=1
it routes to Claude via Amazon Bedrock for true generative copy.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..config import settings

GRADE_BLURB = {
    "A+": "barely used and indistinguishable from new",
    "A": "in excellent condition with only the faintest signs of use",
    "B": "in good, fully-functional condition with light cosmetic wear",
    "C": "in fair condition — a great value pick that works perfectly",
    "D": "sold for parts/repair",
}


@dataclass
class GeneratedListing:
    title: str
    description: str
    highlights: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    condition_disclosure: str = ""


def generate_listing(
    *,
    product_title: str,
    brand: str,
    category: str,
    grade: str,
    grade_label: str,
    damage_notes: list[str],
    price: float,
    age_months: int,
) -> GeneratedListing:
    if settings.use_bedrock:
        result = _generate_with_bedrock(
            product_title=product_title, brand=brand, grade=grade, notes=damage_notes
        )
        if result is not None:
            return result

    title = f"{brand + ' ' if brand else ''}{product_title} — Certified Preloved ({grade_label})"
    blurb = GRADE_BLURB.get(grade, "in good condition")
    age_str = (
        "practically new" if age_months <= 1 else f"gently used for ~{age_months} months"
    )

    description = (
        f"This {product_title} is {blurb}. {age_str.capitalize()}, it has been "
        f"AI-inspected and graded {grade} ({grade_label}) by Second Life Commerce. "
        f"Every Certified Preloved item ships with our Second Life Guarantee: if it "
        f"doesn't match the AI condition report, you get a full refund — no questions. "
        f"Buy it for ₹{price:.0f} and give a great product a second life."
    )

    highlights = [
        f"AI condition grade: {grade} ({grade_label})",
        "Certified Preloved — Second Life Guarantee included",
        f"Verified carbon savings vs. buying new",
    ] + [f"Inspection note: {n}" for n in damage_notes[:2]]

    keywords = list(
        dict.fromkeys(
            [
                brand.lower(),
                category,
                "certified preloved",
                "refurbished",
                grade_label.lower(),
                "sustainable",
                "second life",
            ]
        )
    )
    keywords = [k for k in keywords if k]

    disclosure = "Condition disclosure: " + "; ".join(damage_notes)

    return GeneratedListing(
        title=title,
        description=description,
        highlights=highlights,
        keywords=keywords,
        condition_disclosure=disclosure,
    )


def _generate_with_bedrock(
    *, product_title: str, brand: str, grade: str, notes: list[str]
) -> GeneratedListing | None:  # pragma: no cover
    try:
        import json

        import boto3  # type: ignore

        client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
        prompt = (
            "Write a concise, honest resale listing (title, 3-sentence description, "
            "3 highlights, 6 SEO keywords) for this preloved item. Return JSON with keys "
            "title, description, highlights, keywords. Item: "
            f"{brand} {product_title}, AI condition grade {grade}, notes: {notes}."
        )
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 600,
            "messages": [{"role": "user", "content": prompt}],
        }
        resp = client.invoke_model(
            modelId=settings.bedrock_model_id, body=json.dumps(body)
        )
        payload = json.loads(resp["body"].read())
        text = payload["content"][0]["text"]
        data = json.loads(text)
        return GeneratedListing(
            title=data["title"],
            description=data["description"],
            highlights=data.get("highlights", []),
            keywords=data.get("keywords", []),
            condition_disclosure="; ".join(notes),
        )
    except Exception:
        return None
