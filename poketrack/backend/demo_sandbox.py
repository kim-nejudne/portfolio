"""Per-session copies of the demo world.

The demo world `seed_demo.py` builds in the main database is a template that
visitors never write to. Signing in as a demo trainer copies it into a database
of its own, and that visitor's bearer token carries the sandbox id. Every
request on that token is routed there by `get_db()`, so a visitor can delete a
team or evolve a partner without anyone else seeing it, and the copy is dropped
on sign-out or when the session runs out.

The copy keeps every id, email and name, which is why no route needs to know a
sandbox exists.
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Set

from motor.motor_asyncio import AsyncIOMotorDatabase

from database import get_client, get_main_db, setup_indexes

logger = logging.getLogger("poketrack.demo")

SANDBOX_TTL = timedelta(hours=2)
# Each sandbox is a database with ~20 files behind it; this bounds the disk a
# script hammering the demo button can take.
MAX_SANDBOXES = 100
DB_PREFIX = "pt_demo_"


async def demo_world_queries(db) -> Dict[str, Dict[str, Any]]:
    """{collection: query} for everything reachable from a demo user.

    Walks out from users marked `is_demo` rather than matching a marker, because
    a team or ticket created while signed in as a demo account carries none.
    Only teams a demo user *owns* are in scope — one a demo user merely joined
    belongs to somebody real. Children come before parents, the order a wipe
    deletes them in.
    """
    demo_users = await db.users.find({"is_demo": True}, {"id": 1}).to_list(1000)
    user_ids = [u["id"] for u in demo_users]
    if not user_ids:
        return {}

    teams = await db.teams.find({"owner_id": {"$in": user_ids}}, {"id": 1}).to_list(1000)
    team_ids = [t["id"] for t in teams]

    projects = await db.projects.find({"team_id": {"$in": team_ids}}, {"id": 1}).to_list(1000)
    project_ids = [p["id"] for p in projects]

    mons = await db.player_pokemon.find(
        {"$or": [{"project_id": {"$in": project_ids}}, {"user_id": {"$in": user_ids}}]},
        {"id": 1},
    ).to_list(10000)
    mon_ids = [m["id"] for m in mons]

    return {
        "xp_events": {"player_pokemon_id": {"$in": mon_ids}},
        "evolutions": {"player_pokemon_id": {"$in": mon_ids}},
        "player_pokemon": {"id": {"$in": mon_ids}},
        "tickets": {"project_id": {"$in": project_ids}},
        "projects": {"id": {"$in": project_ids}},
        "invites": {"team_id": {"$in": team_ids}},
        # Both halves matter: memberships of any demo team, and demo users'
        # memberships of teams that survive.
        "memberships": {"$or": [{"team_id": {"$in": team_ids}},
                                {"user_id": {"$in": user_ids}}]},
        "teams": {"id": {"$in": team_ids}},
        "users": {"id": {"$in": user_ids}},
    }


_demo_user_ids: Optional[Set[str]] = None


async def demo_user_ids() -> Set[str]:
    """The template's demo user ids. Cached: they are uuid5s a reseed reproduces."""
    global _demo_user_ids
    if _demo_user_ids:
        return _demo_user_ids
    rows = await get_main_db().users.find({"is_demo": True}, {"id": 1}).to_list(1000)
    ids = {r["id"] for r in rows}
    # Not cached while empty: an API that boots before the first seed would
    # otherwise never learn the ids.
    if ids:
        _demo_user_ids = ids
    return ids


def sandbox_db(sid: str) -> AsyncIOMotorDatabase:
    return get_client()[f"{DB_PREFIX}{sid}"]


async def live_sandbox(sid: str) -> Optional[AsyncIOMotorDatabase]:
    row = await get_main_db().demo_sandboxes.find_one({"id": sid})
    if not row or row["expires_at"].replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc):
        return None
    return sandbox_db(sid)


async def create_sandbox() -> str:
    main = get_main_db()
    sid = secrets.token_hex(8)
    now = datetime.now(timezone.utc)

    live = await main.demo_sandboxes.find({}, {"id": 1}).sort("created_at", 1).to_list(None)
    for row in live[: max(0, len(live) - MAX_SANDBOXES + 1)]:
        await drop_sandbox(row["id"])

    # Registered first, so a copy that dies halfway is still swept.
    await main.demo_sandboxes.insert_one(
        {"id": sid, "created_at": now, "expires_at": now + SANDBOX_TTL}
    )
    target = sandbox_db(sid)
    await setup_indexes(target)
    for collection, query in (await demo_world_queries(main)).items():
        docs = await main[collection].find(query).to_list(None)
        if docs:
            await target[collection].insert_many(docs)
    return sid


async def drop_sandbox(sid: str) -> None:
    await get_client().drop_database(f"{DB_PREFIX}{sid}")
    await get_main_db().demo_sandboxes.delete_one({"id": sid})


async def sweep_expired() -> int:
    """Drop expired sandboxes, and any sandbox database with no registry row."""
    main = get_main_db()
    now = datetime.now(timezone.utc)
    expired = await main.demo_sandboxes.find({"expires_at": {"$lte": now}}, {"id": 1}).to_list(None)
    for row in expired:
        await drop_sandbox(row["id"])

    # List databases before reading the registry: a sandbox registers before its
    # database exists, so one created mid-sweep is always in `known`.
    names = await get_client().list_database_names()
    known = {r["id"] for r in await main.demo_sandboxes.find({}, {"id": 1}).to_list(None)}
    orphans = [
        name for name in names
        if name.startswith(DB_PREFIX) and name[len(DB_PREFIX):] not in known
    ]
    for name in orphans:
        await get_client().drop_database(name)

    dropped = len(expired) + len(orphans)
    if dropped:
        logger.info("Swept %d demo sandbox(es).", dropped)
    return dropped
