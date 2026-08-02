"""Auth routes: sign up, sign in, me."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from auth import (
    create_token,
    current_user_id,
    hash_password,
    verify_password,
)
from database import get_db
from models import UserCreate, UserLogin, UserOut, new_id, now_iso

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/sign-up")
async def sign_up(body: UserCreate):
    db = get_db()
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "id": new_id(),
        "email": email,
        "name": body.name.strip() or email.split("@")[0],
        "avatar_url": None,
        "password_hash": hash_password(body.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_doc["id"])
    return {
        "token": token,
        "user": UserOut(
            id=user_doc["id"], email=user_doc["email"], name=user_doc["name"], avatar_url=None
        ).model_dump(),
    }


@router.post("/sign-in")
async def sign_in(body: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"])
    return {
        "token": token,
        "user": UserOut(
            id=user["id"], email=user["email"], name=user["name"], avatar_url=user.get("avatar_url")
        ).model_dump(),
    }


@router.get("/demo-accounts")
async def demo_accounts():
    """Credentials the sign-in page offers as one-click buttons.

    Unauthenticated on purpose — a recruiter has nothing to sign in with yet,
    which is the whole problem this solves. The passwords are real but they are
    only ever attached to seeded accounts inside a world `seed_demo.py` rebuilds
    on a schedule; there is nothing here to protect.

    Read straight out of the database rather than a constant, so an unseeded
    instance returns an empty list and the sign-in page renders as it always
    did. `demo_password` is stored on the user document and is returned by this
    route alone — no other response model carries it.
    """
    db = get_db()
    rows = await db.users.find(
        {"is_demo_login": True},
        {"_id": 0, "email": 1, "name": 1, "demo_password": 1,
         "demo_role_label": 1, "demo_blurb": 1, "demo_order": 1},
    ).to_list(20)
    rows.sort(key=lambda r: (r.get("demo_order", 99), r.get("email", "")))
    return [
        {
            "email": r["email"],
            "password": r.get("demo_password", ""),
            "name": r.get("name", ""),
            "role_label": r.get("demo_role_label", ""),
            "blurb": r.get("demo_blurb", ""),
        }
        for r in rows
        if r.get("demo_password")
    ]


@router.get("/me")
async def me(uid: str = Depends(current_user_id)):
    db = get_db()
    user = await db.users.find_one({"id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(
        id=user["id"], email=user["email"], name=user["name"], avatar_url=user.get("avatar_url")
    ).model_dump()
