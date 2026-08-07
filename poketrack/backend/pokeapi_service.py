"""MongoDB-backed PokéAPI cache and helpers used by the app.

Pre-warms on startup for the 27 starters + their evolution chains + growth rates,
and caches everything else lazily so we never block gameplay.
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

logger = logging.getLogger("pokeapi")

BASE_URL = "https://pokeapi.co/api/v2"

# Best-effort fallback: reuse the POC's on-disk cache if network is unreachable.
FALLBACK_CACHE_DIR = Path(__file__).parent / "poc" / "_cache"

STARTERS: List[Tuple[int, str]] = [
    (1, "Bulbasaur"), (4, "Charmander"), (7, "Squirtle"),
    (152, "Chikorita"), (155, "Cyndaquil"), (158, "Totodile"),
    (252, "Treecko"), (255, "Torchic"), (258, "Mudkip"),
    (387, "Turtwig"), (390, "Chimchar"), (393, "Piplup"),
    (495, "Snivy"), (498, "Tepig"), (501, "Oshawott"),
    (650, "Chespin"), (653, "Fennekin"), (656, "Froakie"),
    (722, "Rowlet"), (725, "Litten"), (728, "Popplio"),
    (810, "Grookey"), (813, "Scorbunny"), (816, "Sobble"),
    (906, "Sprigatito"), (909, "Fuecoco"), (912, "Quaxly"),
]

STARTER_IDS = {sid for sid, _ in STARTERS}


class PokeApi:
    def __init__(self, db):
        self.db = db
        self._locks: Dict[str, asyncio.Lock] = {}

    def _lock_for(self, key: str) -> asyncio.Lock:
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    async def _fetch_and_cache(self, key: str) -> Dict[str, Any]:
        # 1) DB cache
        doc = await self.db.pokeapi_cache.find_one({"key": key})
        if doc is not None:
            return doc["payload"]
        async with self._lock_for(key):
            # double check after lock
            doc = await self.db.pokeapi_cache.find_one({"key": key})
            if doc is not None:
                return doc["payload"]
            # 2) HTTP
            url = f"{BASE_URL}/{key}"
            payload: Optional[Dict[str, Any]] = None
            try:
                r = await asyncio.to_thread(requests.get, url, timeout=15)
                r.raise_for_status()
                payload = r.json()
            except Exception as e:  # noqa: BLE001
                logger.warning("PokeAPI fetch failed for %s: %s", url, e)
                # 3) file fallback (from POC)
                fp = FALLBACK_CACHE_DIR / (key.replace("/", "__") + ".json")
                if fp.exists():
                    try:
                        payload = json.loads(fp.read_text("utf-8"))
                    except Exception:
                        payload = None
            if payload is None:
                raise RuntimeError(f"PokeAPI unavailable for {key} and no fallback cache present")
            await self.db.pokeapi_cache.update_one(
                {"key": key},
                {"$set": {"key": key, "payload": payload}},
                upsert=True,
            )
            return payload

    async def species(self, id_or_name) -> Dict[str, Any]:
        return await self._fetch_and_cache(f"pokemon-species/{id_or_name}")

    async def pokemon(self, id_or_name) -> Dict[str, Any]:
        return await self._fetch_and_cache(f"pokemon/{id_or_name}")

    async def evolution_chain(self, chain_id: int) -> Dict[str, Any]:
        return await self._fetch_and_cache(f"evolution-chain/{chain_id}")

    async def growth_rate(self, name_or_id) -> Dict[str, Any]:
        return await self._fetch_and_cache(f"growth-rate/{name_or_id}")

    async def prewarm(self) -> None:
        """Pre-fetch the 27 starters and everything transitively needed."""
        logger.info("Pre-warming PokeAPI cache for %d starters...", len(STARTERS))
        growth_names: set[str] = set()
        for sid, name in STARTERS:
            try:
                sp = await self.species(sid)
                _ = await self.pokemon(sid)
                chain_url = sp.get("evolution_chain", {}).get("url", "")
                chain_id = int([p for p in chain_url.split("/") if p][-1])
                chain = await self.evolution_chain(chain_id)
                # walk the chain and prefetch all species+pokemon in it
                await self._prefetch_chain(chain.get("chain", {}))
                gr_name = sp.get("growth_rate", {}).get("name", "medium")
                growth_names.add(gr_name)
            except Exception as e:  # noqa: BLE001
                logger.warning("Prewarm failed for %s (%s): %s", name, sid, e)
        for gr in growth_names:
            try:
                await self.growth_rate(gr)
            except Exception as e:  # noqa: BLE001
                logger.warning("Prewarm growth-rate %s failed: %s", gr, e)
        # Also pre-warm Eevee's chain explicitly (branching test example in UI)
        try:
            eevee_species = await self.species(133)
            chain_url = eevee_species.get("evolution_chain", {}).get("url", "")
            chain_id = int([p for p in chain_url.split("/") if p][-1])
            chain = await self.evolution_chain(chain_id)
            await self._prefetch_chain(chain.get("chain", {}))
        except Exception as e:  # noqa: BLE001
            logger.warning("Prewarm Eevee chain failed: %s", e)
        logger.info("Pre-warm complete.")

    async def _prefetch_chain(self, node: Dict[str, Any]) -> None:
        sp = node.get("species", {})
        url = sp.get("url", "")
        if not url:
            return
        sid = int([p for p in url.split("/") if p][-1])
        try:
            await self.species(sid)
            await self.pokemon(sid)
        except Exception:
            pass
        for child in node.get("evolves_to", []) or []:
            await self._prefetch_chain(child)
