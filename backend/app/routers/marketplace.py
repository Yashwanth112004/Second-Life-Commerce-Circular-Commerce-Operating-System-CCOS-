"""Circular marketplace listings (Certified Preloved + the other five channels)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import OwnedItem, Product, ResaleListing, User

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])

# The six interconnected marketplaces from Section 8.
MARKETPLACES = [
    {"id": "certified_preloved", "name": "Certified Preloved", "desc": "AI-graded used products with full condition disclosure"},
    {"id": "rental", "name": "Rental", "desc": "Rent for days, weeks, or months"},
    {"id": "p2p", "name": "Peer-to-Peer Resale", "desc": "C2C resale inside Amazon's trusted rails"},
    {"id": "exchange", "name": "Exchange", "desc": "Direct item swaps — no money changes hands"},
    {"id": "donation", "name": "Donation", "desc": "Match donors with verified NGOs"},
    {"id": "parts", "name": "Parts & Materials", "desc": "Harvest value from end-of-life products"},
]


@router.get("/channels")
def channels() -> list[dict]:
    return MARKETPLACES


@router.get("/listings")
def listings(category: str | None = None, db: Session = Depends(get_db)) -> list[dict]:
    q = db.query(ResaleListing).filter(ResaleListing.status == "active")
    rows = q.order_by(ResaleListing.created_at.desc()).all()
    out: list[dict] = []
    for ls in rows:
        item = db.get(OwnedItem, ls.item_id)
        product: Product = item.product
        if category and product.category != category:
            continue
        seller: User = db.get(User, ls.seller_id)
        out.append({
            "id": ls.id,
            "title": ls.title,
            "price": ls.price,
            "msrp": product.msrp,
            "savings_pct": round((1 - ls.price / product.msrp) * 100) if product.msrp else 0,
            "condition_grade": ls.condition_grade,
            "category": product.category,
            "image_url": product.image_url,
            "eco_score": product.eco_score,
            "seller_city": seller.city if seller else "",
            "marketplace": ls.marketplace,
            "keywords": ls.keywords,
        })
    return out
