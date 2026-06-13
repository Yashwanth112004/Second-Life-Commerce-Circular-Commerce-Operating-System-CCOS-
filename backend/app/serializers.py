"""Model -> schema serialization helpers."""
from __future__ import annotations

from .models import OwnedItem, Product, User
from .schemas import OwnedItemOut, ProductOut, UserOut
from .services.green_credits import level_for_balance


def product_out(p: Product) -> ProductOut:
    return ProductOut(
        id=p.id, title=p.title, brand=p.brand, category=p.category,
        msrp=p.msrp, image_url=p.image_url, eco_score=p.eco_score,
    )


def item_out(item: OwnedItem) -> OwnedItemOut:
    return OwnedItemOut(
        id=item.id, product=product_out(item.product),
        purchase_price=item.purchase_price, age_months=item.age_months,
        status=item.status,
    )


def user_out(u: User) -> UserOut:
    return UserOut(
        id=u.id, name=u.name, city=u.city, is_prime=u.is_prime,
        green_credits=u.green_credits, carbon_saved_kg=u.carbon_saved_kg,
        level=level_for_balance(u.green_credits),
    )
