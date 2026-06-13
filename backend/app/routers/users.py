"""Users + owned inventory."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import OwnedItem, User
from ..schemas import OwnedItemOut, UserOut
from ..serializers import item_out, user_out

router = APIRouter(prefix="/api/users", tags=["users"])


def _demo_user(db: Session) -> User:
    """The demo always operates as the first seeded customer."""
    user = db.query(User).filter(User.email == "alex@example.com").first()
    if not user:
        raise HTTPException(404, "Demo user not found. Run `python -m app.seed`.")
    return user


@router.get("/me", response_model=UserOut)
def get_me(db: Session = Depends(get_db)) -> UserOut:
    return user_out(_demo_user(db))


@router.get("/me/items", response_model=list[OwnedItemOut])
def my_items(db: Session = Depends(get_db)) -> list[OwnedItemOut]:
    user = _demo_user(db)
    items = db.query(OwnedItem).filter(OwnedItem.owner_id == user.id).all()
    return [item_out(i) for i in items]
