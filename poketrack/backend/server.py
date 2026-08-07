"""PokéTrack FastAPI server."""
from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from database import get_db, setup_indexes  # noqa: E402
from pokeapi_service import PokeApi  # noqa: E402
from routes_auth import router as auth_router  # noqa: E402
from routes_teams import router as teams_router, invite_router  # noqa: E402
from routes_projects import router as projects_router  # noqa: E402
from routes_tickets import router as tickets_router  # noqa: E402
from routes_game import router as game_router  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("poketrack")

app = FastAPI(title="PokéTrack API", version="1.0.0")

# All routes live under /api
api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(teams_router)
api_router.include_router(invite_router)
api_router.include_router(projects_router)
api_router.include_router(tickets_router)
api_router.include_router(game_router)


@api_router.get("/")
async def root():
    return {"service": "poketrack", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# Expose the PokeApi client as an app singleton
pokeapi: PokeApi | None = None


@app.on_event("startup")
async def _startup() -> None:
    global pokeapi
    db = get_db()
    await setup_indexes()
    pokeapi = PokeApi(db)
    # Pre-warm cache in the background so the API becomes ready fast.
    import asyncio

    async def _bg():
        try:
            await pokeapi.prewarm()  # type: ignore[union-attr]
        except Exception as e:  # noqa: BLE001
            logger.warning("Prewarm errored (non-fatal): %s", e)

    asyncio.create_task(_bg())
    logger.info("PokéTrack backend ready.")


@app.on_event("shutdown")
async def _shutdown() -> None:
    pass
