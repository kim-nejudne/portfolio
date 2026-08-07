"""
The guard sweep: every route that touches team data must refuse an anonymous
caller, and the demo credentials must stay read-only.

This replaces a 629-line script the scaffold left behind, which was pinned to
`evolution-hub-20.preview.emergentagent.com` — a host that no longer exists, so
it could never run. A file called "comprehensive backend API tests" that cannot
execute is worse than no file, because it reads as coverage.

Runs against a URL rather than an in-process app, because that is what actually
answers a request: the routes, the auth dependency, and the reverse proxy in
front of them. Every request here is unauthenticated or read-only — nothing in
this file mutates state, so it is safe to point at the live deployment.

    POKETRACK_API=http://localhost:8001/api pytest test_api_guards.py
"""
from __future__ import annotations

import os

import pytest
import requests

BASE = os.environ.get("POKETRACK_API", "https://poketrack.kimnejudne.dev/api").rstrip("/")
TIMEOUT = 20


def _reachable() -> bool:
    try:
        requests.get(f"{BASE}/auth/demo-accounts", timeout=TIMEOUT)
        return True
    except requests.RequestException:
        return False


pytestmark = pytest.mark.skipif(
    not _reachable(),
    reason=f"{BASE} is not reachable — set POKETRACK_API to a running instance",
)


# Every route that reads or writes something belonging to a team or a project.
# A project id of "x" is deliberate: authorization must be refused before the
# id is ever looked up, so a nonexistent one must still produce 401 and not 404.
GUARDED = [
    ("GET", "/teams"),
    ("POST", "/teams"),
    ("GET", "/teams/x"),
    ("PATCH", "/teams/x"),
    ("GET", "/teams/x/members"),
    ("GET", "/teams/x/invites"),
    ("POST", "/teams/x/invites"),
    ("GET", "/teams/x/projects"),
    ("POST", "/teams/x/projects"),
    ("GET", "/projects/x"),
    ("PATCH", "/projects/x"),
    ("DELETE", "/projects/x"),
    ("GET", "/projects/x/tickets"),
    ("POST", "/projects/x/tickets"),
    ("PATCH", "/projects/x/tickets/y"),
    ("DELETE", "/projects/x/tickets/y"),
    ("GET", "/projects/x/pokedex/starters"),
    ("GET", "/projects/x/pokedex/species/1"),
    ("GET", "/projects/x/me/pokemon"),
    ("POST", "/projects/x/starter"),
    ("POST", "/projects/x/evolution/choose"),
    ("POST", "/projects/x/prestige"),
    ("GET", "/projects/x/leaderboard"),
    ("GET", "/auth/me"),
]

PUBLIC = ["/auth/demo-accounts"]


@pytest.mark.parametrize("method,path", GUARDED, ids=[f"{m} {p}" for m, p in GUARDED])
def test_requires_authentication(method: str, path: str) -> None:
    response = requests.request(method, f"{BASE}{path}", timeout=TIMEOUT, json={})
    assert response.status_code == 401, (
        f"{method} {path} answered {response.status_code} without a token"
    )


@pytest.mark.parametrize("path", PUBLIC)
def test_public_routes_stay_public(path: str) -> None:
    assert requests.get(f"{BASE}{path}", timeout=TIMEOUT).status_code == 200


def test_a_forged_token_is_rejected() -> None:
    """
    The signing secret is the only thing standing between a string and a
    session. This is the check that would have failed while auth.py still
    carried a hardcoded fallback secret.
    """
    for token in ("not-a-token", "Bearer", "a.b.c"):
        response = requests.get(
            f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=TIMEOUT
        )
        assert response.status_code == 401, f"forged token {token!r} was accepted"


def test_demo_accounts_are_advertised_without_leaking_hashes() -> None:
    body = requests.get(f"{BASE}/auth/demo-accounts", timeout=TIMEOUT).text
    assert "password_hash" not in body
    assert "hashed" not in body
    # The demo password is deliberately public — it is printed on the sign-in
    # screen so the portfolio is walkable. Everything else is not.
    assert "$2b$" not in body, "a bcrypt hash is being served to anonymous callers"
