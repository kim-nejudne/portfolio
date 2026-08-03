"""JWT + bcrypt auth helpers and dependencies."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException

def _require_jwt_secret() -> str:
    """
    Refuse to start without a real signing secret.

    This used to fall back to a hardcoded default. The deployed stack does set
    JWT_SECRET, so the fallback was never reached in production — but a default
    that is committed to a public-facing repository is not a secret, and the
    failure mode is silent: the app boots happily and signs every session token
    with a value anyone reading the source already knows. A missing secret
    should be a failed deploy, not a working one with forgeable tokens.

    Matches how TALLOW and FORME handle their own signing secrets.
    """
    secret = os.environ.get("JWT_SECRET", "").strip()
    if len(secret) < 32:
        raise RuntimeError(
            "JWT_SECRET is missing or shorter than 32 characters. The API will "
            "not start. Generate one with `openssl rand -base64 48`."
        )
    return secret


JWT_SECRET = _require_jwt_secret()
JWT_ALGO = "HS256"
JWT_TTL_HOURS = 24 * 30


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload.get("sub")
    except Exception:
        return None


async def current_user_id(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.strip() or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    uid = decode_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return uid
