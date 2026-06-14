"""SQLAlchemy models — a production-shaped slice of the CCOS data model.

These mirror the tables described in docs/DATA_MODEL.md. The MVP uses the subset
needed to drive the full return -> resale -> carbon -> green-credit -> passport flow
plus the Autonomous Resale Agent.
"""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(180), unique=True)
    city: Mapped[str] = mapped_column(String(120), default="Bengaluru")
    zip_code: Mapped[str] = mapped_column(String(12), default="98101")
    is_prime: Mapped[bool] = mapped_column(default=True)
    green_credits: Mapped[float] = mapped_column(Float, default=0.0)
    carbon_saved_kg: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_now)

    items: Mapped[list["OwnedItem"]] = relationship(back_populates="owner")


class Product(Base):
    """Catalog product (a SKU)."""

    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(240))
    brand: Mapped[str] = mapped_column(String(120), default="")
    category: Mapped[str] = mapped_column(String(60), index=True)
    msrp: Mapped[float] = mapped_column(Float)
    weight_kg: Mapped[float] = mapped_column(Float, default=1.0)
    # Manufacturing carbon footprint of a new unit (kg CO2e). Used by the carbon engine.
    embedded_carbon_kg: Mapped[float] = mapped_column(Float, default=6.0)
    image_url: Mapped[str] = mapped_column(String(400), default="")
    eco_score: Mapped[int] = mapped_column(Integer, default=60)  # 0-100


class OwnedItem(Base):
    """A physical unit owned by a user (the thing that gets returned / resold)."""

    __tablename__ = "owned_items"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    purchase_price: Mapped[float] = mapped_column(Float)
    purchased_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_now)
    age_months: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(40), default="owned")
    # owned | return_initiated | listed | sold | donated | recycled

    owner: Mapped[User] = relationship(back_populates="items")
    product: Mapped[Product] = relationship()


class ReturnRequest(Base):
    __tablename__ = "return_requests"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    item_id: Mapped[str] = mapped_column(ForeignKey("owned_items.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    reason_code: Mapped[str] = mapped_column(String(60), default="changed_mind")
    reason_text: Mapped[str] = mapped_column(Text, default="")
    refund_amount: Mapped[float] = mapped_column(Float, default=0.0)
    chosen_path: Mapped[str] = mapped_column(String(40), default="undecided")
    # undecided | refund | resell | donate | exchange | keep
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_now)


class ConditionAssessment(Base):
    """Output of the Damage Detection Vision AI (DDVA)."""

    __tablename__ = "condition_assessments"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    item_id: Mapped[str] = mapped_column(ForeignKey("owned_items.id"))
    grade: Mapped[str] = mapped_column(String(4))  # A+, A, B, C, D
    grade_label: Mapped[str] = mapped_column(String(40))
    confidence: Mapped[float] = mapped_column(Float)
    damage_notes: Mapped[list] = mapped_column(JSON, default=list)
    recommended_disposition: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_now)


class ResaleListing(Base):
    __tablename__ = "resale_listings"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    item_id: Mapped[str] = mapped_column(ForeignKey("owned_items.id"))
    seller_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str] = mapped_column(Text)
    price: Mapped[float] = mapped_column(Float)
    condition_grade: Mapped[str] = mapped_column(String(4))
    marketplace: Mapped[str] = mapped_column(String(40), default="certified_preloved")
    status: Mapped[str] = mapped_column(String(30), default="active")
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_now)


class CarbonRecord(Base):
    __tablename__ = "carbon_records"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    item_id: Mapped[str] = mapped_column(ForeignKey("owned_items.id"))
    action: Mapped[str] = mapped_column(String(40))  # resale | donation | repair | rental
    carbon_saved_kg: Mapped[float] = mapped_column(Float)
    water_saved_l: Mapped[float] = mapped_column(Float, default=0.0)
    waste_diverted_kg: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_now)


class GreenCreditLedger(Base):
    __tablename__ = "green_credit_ledger"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    delta: Mapped[float] = mapped_column(Float)  # +earned / -spent
    reason: Mapped[str] = mapped_column(String(120))
    balance_after: Mapped[float] = mapped_column(Float)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_now)


class PassportEvent(Base):
    """An append-only lifecycle event for the Digital Product Passport (DPP)."""

    __tablename__ = "passport_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    item_id: Mapped[str] = mapped_column(ForeignKey("owned_items.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(40))
    # manufactured | first_sale | inspection | repair | ownership_transfer | resale | end_of_life
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    actor: Mapped[str] = mapped_column(String(120), default="system")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_now)
