"""Lightweight PokéAPI client with local file caching for POC.

The production app will use MongoDB, but for the POC we use a JSON file cache
on disk so runs are cheap and offline-friendly after the first fetch.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional

import requests

BASE_URL = "https://pokeapi.co/api/v2"

CACHE_DIR = Path(__file__).parent / "_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _cache_path(key: str) -> Path:
    safe = key.replace("/", "__")
    return CACHE_DIR / f"{safe}.json"


def _read_cache(key: str) -> Optional[Dict[str, Any]]:
    p = _cache_path(key)
    if p.exists():
        try:
            return json.loads(p.read_text("utf-8"))
        except Exception:
            return None
    return None


def _write_cache(key: str, payload: Dict[str, Any]) -> None:
    _cache_path(key).write_text(json.dumps(payload), "utf-8")


def _get(url: str, cache_key: str, force: bool = False) -> Dict[str, Any]:
    if not force:
        cached = _read_cache(cache_key)
        if cached is not None:
            return cached
    # Retry with backoff
    last_err: Optional[Exception] = None
    for attempt in range(4):
        try:
            r = requests.get(url, timeout=20)
            r.raise_for_status()
            data = r.json()
            _write_cache(cache_key, data)
            return data
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(0.5 * (2 ** attempt))
    raise RuntimeError(f"PokéAPI fetch failed for {url}: {last_err}")


def get_pokemon(id_or_name: str | int) -> Dict[str, Any]:
    key = f"pokemon/{id_or_name}"
    return _get(f"{BASE_URL}/{key}", key)


def get_species(id_or_name: str | int) -> Dict[str, Any]:
    key = f"pokemon-species/{id_or_name}"
    return _get(f"{BASE_URL}/{key}", key)


def get_evolution_chain(chain_id: int) -> Dict[str, Any]:
    key = f"evolution-chain/{chain_id}"
    return _get(f"{BASE_URL}/{key}", key)


def get_growth_rate(name_or_id: str | int) -> Dict[str, Any]:
    key = f"growth-rate/{name_or_id}"
    return _get(f"{BASE_URL}/{key}", key)


def chain_id_from_species(species_json: Dict[str, Any]) -> int:
    url = species_json.get("evolution_chain", {}).get("url", "")
    # ends with /<id>/
    parts = [p for p in url.split("/") if p]
    return int(parts[-1])


def growth_rate_name_from_species(species_json: Dict[str, Any]) -> str:
    return species_json.get("growth_rate", {}).get("name", "medium")


def species_id_from_url(url: str) -> int:
    parts = [p for p in url.split("/") if p]
    return int(parts[-1])
