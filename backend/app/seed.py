"""Create and seed the CCOS database with demo data.

Run with:  python -m app.seed
"""
from __future__ import annotations

import datetime as dt

from .db import Base, SessionLocal, engine, init_db
from .models import (
    OwnedItem,
    PassportEvent,
    Product,
    ResaleListing,
    User,
)

# (title, brand, category, msrp, weight_kg, embedded_carbon_kg, eco_score, image)
PRODUCTS = [
    ("Wireless Noise-Cancelling Earbuds", "Soundwave", "electronics", 40, 0.3, 9.0, 58,
     "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400"),
    ("4K Action Camera", "Vantage", "electronics", 320, 0.6, 78.0, 64,
     "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400"),
    ("Bluetooth Portable Speaker", "Sony", "electronics", 130, 0.9, 32.0, 70,
     "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400"),
    ("Mechanical Keyboard", "KeyForge", "electronics", 110, 1.1, 24.0, 72,
     "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400"),
    ("Mirrorless Camera Body", "Vantage", "electronics", 800, 0.7, 120.0, 66,
     "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400"),
    ("Down Insulated Jacket", "NorthPeak", "apparel", 180, 0.8, 28.0, 55,
     "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400"),
    ("Running Shoes", "Stride", "apparel", 130, 0.6, 14.0, 60,
     "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400"),
    ("Stand Mixer", "HomeChef", "home", 290, 5.0, 64.0, 68,
     "https://images.unsplash.com/photo-1578643463396-0997cb5328c1?w=400"),
    ("Espresso Machine", "Crema", "home", 240, 4.2, 58.0, 62,
     "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400"),
    ("Robot Vacuum", "TidyBot", "home", 350, 3.5, 70.0, 65,
     "https://images.unsplash.com/photo-1603618304243-ce8c8d6e1f01?w=400"),
]


def seed() -> None:
    Base.metadata.drop_all(bind=engine)
    init_db()

    db = SessionLocal()
    try:
        # Catalog
        products: list[Product] = []
        for title, brand, cat, msrp, wt, carbon, eco, img in PRODUCTS:
            p = Product(
                title=title, brand=brand, category=cat, msrp=msrp,
                weight_kg=wt, embedded_carbon_kg=carbon, eco_score=eco, image_url=img,
            )
            db.add(p)
            products.append(p)
        db.flush()

        # Demo customer
        user = User(
            name="Aarav Sharma", email="alex@example.com",
            city="Bengaluru", zip_code="560001", is_prime=True,
            green_credits=12.0, carbon_saved_kg=12.0,
        )
        db.add(user)
        db.flush()

        # Purchase history. The first item is the "active return" star of the demo
        # (recent earbuds). The rest are older, higher-value items the ARA discovers.
        now = dt.datetime.now(dt.timezone.utc)
        history = [
            (products[0], 40, 0),    # earbuds - just purchased (the return demo)
            (products[2], 130, 8),   # Sony speaker - ARA candidate
            (products[1], 320, 11),  # action camera - ARA candidate
            (products[4], 800, 14),  # mirrorless body - top ARA candidate
            (products[7], 290, 9),   # stand mixer - ARA candidate
            (products[5], 180, 7),   # jacket - ARA candidate
            (products[3], 110, 10),  # keyboard - ARA candidate
        ]
        first_item: OwnedItem | None = None
        for product, price, age in history:
            item = OwnedItem(
                product_id=product.id, owner_id=user.id,
                purchase_price=price, age_months=age,
                purchased_at=now - dt.timedelta(days=age * 30),
                status="owned",
            )
            db.add(item)
            db.flush()
            if first_item is None:
                first_item = item
            # Birth event + first sale event for the passport.
            db.add(PassportEvent(
                item_id=item.id, event_type="manufactured", actor="manufacturer",
                detail={"origin": "Vietnam", "embedded_carbon_kg": product.embedded_carbon_kg},
                created_at=item.purchased_at - dt.timedelta(days=45),
            ))
            db.add(PassportEvent(
                item_id=item.id, event_type="first_sale", actor="Amazon",
                detail={"price": price, "region": "IN-KA"},
                created_at=item.purchased_at,
            ))

        # A few existing marketplace listings from other sellers (for the marketplace view).
        seller = User(
            name="Rohan Mehta", email="jordan@example.com",
            city="Mumbai", zip_code="400001", is_prime=True,
            green_credits=340.0, carbon_saved_kg=340.0,
        )
        db.add(seller)
        db.flush()
        market = [
            (products[8], "B", 132, "Espresso Machine — Certified Preloved (Good)"),
            (products[9], "A", 210, "Robot Vacuum — Certified Preloved (Excellent)"),
            (products[6], "A+", 78, "Running Shoes — Certified Preloved (Like New)"),
        ]
        for product, grade, price, title in market:
            item = OwnedItem(
                product_id=product.id, owner_id=seller.id,
                purchase_price=product.msrp, age_months=12, status="listed",
            )
            db.add(item)
            db.flush()
            db.add(ResaleListing(
                item_id=item.id, seller_id=seller.id, title=title,
                description="AI-inspected Certified Preloved item with Second Life Guarantee.",
                price=price, condition_grade=grade, marketplace="certified_preloved",
                keywords=[product.category, "certified preloved", "sustainable"],
            ))

        db.commit()
        print(f"Seeded {len(products)} products, demo user {user.name} ({user.id}),")
        print(f"  {len(history)} owned items, {len(market)} marketplace listings.")
        print(f"  Active return demo item: {first_item.id if first_item else 'n/a'}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
