"""MongoDB client + index setup."""
from __future__ import annotations

import os
from contextvars import ContextVar

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None

# Set by `current_user_id` when the bearer token belongs to a demo sandbox, so
# every `get_db()` in that request lands in the visitor's own copy. Each request
# runs in its own context, so the value never leaks into another one.
_request_db: ContextVar[AsyncIOMotorDatabase | None] = ContextVar("request_db", default=None)


def get_client() -> AsyncIOMotorClient:
    get_main_db()
    assert _client is not None
    return _client


def get_main_db() -> AsyncIOMotorDatabase:
    global _client, _db
    if _db is None:
        _client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        _db = _client[os.environ.get("DB_NAME", "poketrack")]
    return _db


def get_db() -> AsyncIOMotorDatabase:
    db = _request_db.get()
    return db if db is not None else get_main_db()


def use_request_db(db: AsyncIOMotorDatabase) -> None:
    _request_db.set(db)


async def setup_indexes(db: AsyncIOMotorDatabase | None = None) -> None:
    db = db if db is not None else get_main_db()
    await db.users.create_index("email", unique=True)
    await db.memberships.create_index([("team_id", ASCENDING), ("user_id", ASCENDING)], unique=True)
    await db.memberships.create_index("user_id")
    await db.invites.create_index("token", unique=True)
    await db.invites.create_index([("team_id", ASCENDING), ("email", ASCENDING), ("status", ASCENDING)])
    await db.projects.create_index("team_id")
    await db.tickets.create_index([("project_id", ASCENDING), ("status", ASCENDING)])
    await db.player_pokemon.create_index([("project_id", ASCENDING), ("user_id", ASCENDING)], unique=True)
    await db.xp_events.create_index("player_pokemon_id")
    await db.xp_events.create_index("ticket_id")
    # Read on every partner and leaderboard row — derive_state needs the
    # committed branch choices to walk past a fork.
    await db.evolutions.create_index("player_pokemon_id")
    await db.pokeapi_cache.create_index("key", unique=True)
