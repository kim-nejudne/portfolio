"""
Demo sessions are private and throwaway: what one visitor does in a demo
account is invisible to the next, and gone once they sign out.

Runs against a URL, like the guard sweep. It writes only inside sandboxes it
creates and signs out of, so the template every visitor is copied from is
never touched — safe to point at the live deployment.

    POKETRACK_API=http://localhost:8001/api pytest test_demo_sandbox.py
"""
from __future__ import annotations

import base64
import json
import os

import pytest
import requests

BASE = os.environ.get("POKETRACK_API", "https://poketrack.kimnejudne.dev/api").rstrip("/")
TIMEOUT = 20


def _demo_accounts() -> list:
    try:
        return requests.get(f"{BASE}/auth/demo-accounts", timeout=TIMEOUT).json()
    except requests.RequestException:
        return []


DEMOS = _demo_accounts()
OWNER = next((d for d in DEMOS if d["email"].startswith("owner@")), None)

pytestmark = pytest.mark.skipif(
    OWNER is None,
    reason=f"{BASE} is not reachable or has no seeded demo owner — set POKETRACK_API",
)


def _sign_in() -> dict:
    r = requests.post(
        f"{BASE}/auth/sign-in",
        json={"email": OWNER["email"], "password": OWNER["password"]},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    token = r.json()["token"]
    # Without a sandbox claim this session writes to the shared demo world —
    # an API from before sandboxes. Stop before the delete below can land there.
    body = token.split(".")[1]
    claims = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    assert claims.get("sbx"), f"{BASE} issued a demo token with no sandbox"
    return {"Authorization": f"Bearer {token}"}


def _sign_out(headers: dict) -> None:
    requests.post(f"{BASE}/auth/sign-out", headers=headers, timeout=TIMEOUT)


def _team_ids(headers: dict) -> set:
    r = requests.get(f"{BASE}/teams", headers=headers, timeout=TIMEOUT)
    r.raise_for_status()
    return {t["id"] for t in r.json()}


def test_a_demo_visitors_changes_stay_in_their_own_session() -> None:
    a, b = _sign_in(), _sign_in()
    try:
        teams = requests.get(f"{BASE}/teams", headers=a, timeout=TIMEOUT).json()
        victim = next(t for t in teams if t["my_role"] == "owner")

        r = requests.delete(
            f"{BASE}/teams/{victim['id']}",
            params={"confirm_name": victim["name"]}, headers=a, timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text

        assert victim["id"] not in _team_ids(a)
        assert victim["id"] in _team_ids(b), "another visitor saw the delete"
    finally:
        _sign_out(a)
        _sign_out(b)

    c = _sign_in()
    try:
        assert victim["id"] in _team_ids(c), "the template every session copies was changed"
    finally:
        _sign_out(c)


def test_signing_out_ends_the_demo_session() -> None:
    a = _sign_in()
    assert requests.get(f"{BASE}/teams", headers=a, timeout=TIMEOUT).status_code == 200
    _sign_out(a)
    assert requests.get(f"{BASE}/teams", headers=a, timeout=TIMEOUT).status_code == 401


def test_sign_out_needs_no_token() -> None:
    assert requests.post(f"{BASE}/auth/sign-out", timeout=TIMEOUT).status_code == 200
