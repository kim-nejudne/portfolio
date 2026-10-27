"""JWT + bcrypt auth helpers and dependencies."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException

from database import use_request_db
from demo_sandbox import demo_user_ids, live_sandbox

def _require_jwt_secret() -> str:
    """
    Refuse to start without a real signing secret.

    This used to fall back to a hardcoded default. The deployed stack does set
    JWT_SECRET, so the fallback was never reached in production — but a default
    that is committed to a public-facing repository is not a secret, and the
    failure mode is silent: the app boots happily and signs every session token
    with a value anyone reading the source already knows. A missing secret
    should be a failed deploy, not a working one with forgeable tokens.
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


def create_token(user_id: str, sandbox: Optional[str] = None, ttl: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    payload: Dict[str, Any] = {
        "sub": user_id,
        "iat": now,
        "exp": now + (ttl or timedelta(hours=JWT_TTL_HOURS)),
    }
    if sandbox:
        payload["sbx"] = sandbox
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        return None
    return payload if payload.get("sub") else None


def bearer_payload(authorization: Optional[str]) -> Optional[Dict[str, Any]]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    return decode_token(token) if token else None


async def current_user_id(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.strip() or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    uid = payload["sub"]
    sid = payload.get("sbx")
    if sid:
        # Route the rest of this request into the visitor's own copy of the
        # demo world; see demo_sandbox.py.
        db = await live_sandbox(sid)
        if db is None:
            raise HTTPException(status_code=401, detail="Demo session ended — sign in again")
        use_request_db(db)
    elif uid in await demo_user_ids():
        # A demo token minted before sandboxes existed would write straight
        # into the template every visitor is copied from.
        raise HTTPException(status_code=401, detail="Demo session ended — sign in again")
    return uid
