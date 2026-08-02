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


@router.get("/me")
async def me(uid: str = Depends(current_user_id)):
    db = get_db()
    user = await db.users.find_one({"id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(
        id=user["id"], email=user["email"], name=user["name"], avatar_url=user.get("avatar_url")
    ).model_dump()
