"""MongoDB client + index setup."""
from __future__ import annotations

import os

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_db() -> AsyncIOMotorDatabase:
    global _client, _db
    if _db is None:
        _client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        _db = _client[os.environ.get("DB_NAME", "poketrack")]
    return _db


async def setup_indexes() -> None:
    db = get_db()
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
    await db.pokeapi_cache.create_index("key", unique=True)
