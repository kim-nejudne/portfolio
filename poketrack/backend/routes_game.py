"""Pokemon derived state + starter picking + evolution choice + prestige."""
from __future__ import annotations

import random
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from auth import current_user_id
from database import get_db
from engine import (
    build_growth_table,
    derive_state,
    find_node,
    next_evolution_hint,
    parse_chain,
    resolve_evolutions,
)
from models import ChooseEvolutionRequest, PokemonState, StarterPick, new_id, now_iso
from pokeapi_service import STARTER_IDS, STARTERS
from routes_projects import assert_project_access

router = APIRouter(prefix="/projects", tags=["game"])

SHINY_CHANCE_DENOM = 256


async def _species_bundle(pokeapi, species_id: int) -> Dict[str, Any]:
    sp = await pokeapi.species(species_id)
    pk = await pokeapi.pokemon(species_id)
    chain_url = sp.get("evolution_chain", {}).get("url", "")
    chain_id = int([p for p in chain_url.split("/") if p][-1])
    chain = await pokeapi.evolution_chain(chain_id)
    root = parse_chain(chain)
    gr = await pokeapi.growth_rate(sp["growth_rate"]["name"])
    return {
        "species": sp,
        "pokemon": pk,
        "root": root,
        "growth_table": build_growth_table(gr),
    }


async def _pokemon_data(pokeapi, species_id: int) -> Dict[str, Any]:
    pk = await pokeapi.pokemon(species_id)
    sp = await pokeapi.species(species_id)
    types = [t["type"]["name"] for t in pk.get("types", [])]
    sprites = pk.get("sprites", {})
    default = sprites.get("front_default") or (sprites.get("other", {}).get("official-artwork", {}) or {}).get("front_default")
    shiny = sprites.get("front_shiny") or (sprites.get("other", {}).get("official-artwork", {}) or {}).get("front_shiny") or default
    name = sp.get("name") or pk.get("name") or ""
    return {
        "species_id": species_id,
        "name": name,
        "types": types,
        "sprite": default,
        "shiny_sprite": shiny,
    }


@router.get("/{project_id}/pokedex/starters")
async def get_starters(project_id: str, uid: str = Depends(current_user_id)):
    _project, _ = await assert_project_access(project_id, uid)
    from server import pokeapi  # avoid circular
    out = []
    for sid, label in STARTERS:
        data = await _pokemon_data(pokeapi, sid)
        # Guess generation by species id ranges
        gen = 1
        if sid >= 906:
            gen = 9
        elif sid >= 810:
            gen = 8
        elif sid >= 722:
            gen = 7
        elif sid >= 650:
            gen = 6
        elif sid >= 495:
            gen = 5
        elif sid >= 387:
            gen = 4
        elif sid >= 252:
            gen = 3
        elif sid >= 152:
            gen = 2
        out.append({**data, "label": label, "generation": gen})
    return out


@router.get("/{project_id}/pokedex/species/{species_id}")
async def get_species_data(project_id: str, species_id: int, uid: str = Depends(current_user_id)):
    await assert_project_access(project_id, uid)
    from server import pokeapi
    return await _pokemon_data(pokeapi, species_id)


@router.get("/{project_id}/me/pokemon")
async def get_my_pokemon(project_id: str, uid: str = Depends(current_user_id)):
    return await _get_pokemon_state(project_id, uid)


async def _get_pokemon_state(project_id: str, uid: str) -> Dict[str, Any] | None:
    db = get_db()
    from server import pokeapi
    project, _ = await assert_project_access(project_id, uid)
    doc = await db.player_pokemon.find_one({"project_id": project_id, "user_id": uid})
    if not doc:
        return None
    bundle = await _species_bundle(pokeapi, doc["base_species_id"])
    ledger = await db.xp_events.find({"player_pokemon_id": doc["id"]}).to_list(50000)
    state = derive_state(
        ledger=[{"xp_awarded": e["xp_awarded"]} for e in ledger],
        base_species_id=doc["base_species_id"],
        root=bundle["root"],
        growth_table=bundle["growth_table"],
        synthetic_level=project.get("synthetic_evolution_level", 30),
        level_pct=project.get("evolution_level_pct", 100),
        xp_baseline=doc.get("xp_baseline", 0),
    )
    current_data = await _pokemon_data(pokeapi, state["current_species_id"])
    hint = next_evolution_hint(
        bundle["root"],
        state["current_species_id"],
        state["level"],
        project.get("synthetic_evolution_level", 30),
        project.get("evolution_level_pct", 100),
    )
    # Resolve pending options with names/sprites for the UI (compact)
    pending_details: List[Dict[str, Any]] = []
    if state["pending_evolution"]:
        for sid in state["pending_options"]:
            pending_details.append(await _pokemon_data(pokeapi, sid))
    history_details: List[Dict[str, Any]] = []
    for hop in state["evolutions_history"]:
        frm = await _pokemon_data(pokeapi, hop["from"])
        to = await _pokemon_data(pokeapi, hop["to"])
        history_details.append({"at_level": hop["at_level"], "from": frm, "to": to})
    # Also update stored current_species_id so history is accurate
    if doc.get("current_species_id") != state["current_species_id"] or doc.get("level") != state["level"]:
        await db.player_pokemon.update_one(
            {"id": doc["id"]},
            {"$set": {
                "current_species_id": state["current_species_id"],
                "level": state["level"],
                "total_xp": state["total_xp"],
                "stage_index": state["stage_index"],
                "pending_evolution": state["pending_evolution"],
            }},
        )
    return {
        "id": doc["id"],
        "project_id": project_id,
        "user_id": uid,
        "base_species_id": doc["base_species_id"],
        "current_species_id": state["current_species_id"],
        "level": state["level"],
        "total_xp": state["total_xp"],
        "mon_xp": state["mon_xp"],
        "stage_index": state["stage_index"],
        "total_stages": state["total_stages"],
        "pending_evolution": state["pending_evolution"],
        "pending_options": pending_details,
        "is_shiny": doc.get("is_shiny", False),
        "prestige": doc.get("prestige", 0),
        "xp_baseline": doc.get("xp_baseline", 0),
        "sprite_url": current_data["sprite"],
        "shiny_sprite_url": current_data["shiny_sprite"],
        "species_name": current_data["name"],
        "types": current_data["types"],
        "evolutions_history": history_details,
        "xp_progress_current": state["xp_progress"]["current"] if state["xp_progress"] else 0,
        "xp_progress_needed": state["xp_progress"]["needed"] if state["xp_progress"] else 0,
        "next_hint": hint,
    }


@router.post("/{project_id}/starter")
async def pick_starter(project_id: str, body: StarterPick, uid: str = Depends(current_user_id)):
    db = get_db()
    from server import pokeapi
    if body.species_id not in STARTER_IDS:
        raise HTTPException(status_code=400, detail="Not a valid starter")
    _project, _ = await assert_project_access(project_id, uid)
    # Idempotent: if user already has a pokemon, just return it
    existing = await db.player_pokemon.find_one({"project_id": project_id, "user_id": uid})
    if existing:
        state = await _get_pokemon_state(project_id, uid)
        return {"pokemon": state, "picked": False}
    # roll shiny
    is_shiny = random.randint(1, SHINY_CHANCE_DENOM) == 1
    doc = {
        "id": new_id(),
        "project_id": project_id,
        "user_id": uid,
        "base_species_id": body.species_id,
        "current_species_id": body.species_id,
        "level": 1,
        "total_xp": 0,
        "stage_index": 0,
        "pending_evolution": False,
        "is_shiny": is_shiny,
        "prestige": 0,
        "xp_baseline": 0,
        "created_at": now_iso(),
    }
    try:
        await db.player_pokemon.insert_one(doc)
    except Exception:
        # unique conflict — return existing
        state = await _get_pokemon_state(project_id, uid)
        return {"pokemon": state, "picked": False}
    state = await _get_pokemon_state(project_id, uid)
    return {"pokemon": state, "picked": True, "is_shiny": is_shiny}


@router.post("/{project_id}/evolution/choose")
async def choose_evolution(project_id: str, body: ChooseEvolutionRequest, uid: str = Depends(current_user_id)):
    db = get_db()
    from server import pokeapi
    project, _ = await assert_project_access(project_id, uid)
    doc = await db.player_pokemon.find_one({"project_id": project_id, "user_id": uid})
    if not doc:
        raise HTTPException(status_code=404, detail="No partner yet")
    # Re-derive state to double check
    bundle = await _species_bundle(pokeapi, doc["base_species_id"])
    ledger = await db.xp_events.find({"player_pokemon_id": doc["id"]}).to_list(50000)
    state = derive_state(
        ledger=[{"xp_awarded": e["xp_awarded"]} for e in ledger],
        base_species_id=doc["base_species_id"],
        root=bundle["root"],
        growth_table=bundle["growth_table"],
        synthetic_level=project.get("synthetic_evolution_level", 30),
        level_pct=project.get("evolution_level_pct", 100),
        xp_baseline=doc.get("xp_baseline", 0),
    )
    if not state["pending_evolution"]:
        raise HTTPException(status_code=400, detail="No pending evolution")
    if body.target_species_id not in state["pending_options"]:
        raise HTTPException(status_code=400, detail="Selected species is not an eligible evolution")
    # Commit — record hop, then cascade any further single-path evolutions.
    now = now_iso()
    stalled_species = state["current_species_id"]
    node = find_node(bundle["root"], stalled_species) or {"children": []}
    at_level = state["level"]
    for child in node.get("children", []):
        if child["node"]["species_id"] == body.target_species_id:
            # use synthetic/level_pct-aware gate
            from engine import effective_gate
            at_level = effective_gate(child["details"], project.get("synthetic_evolution_level", 30), project.get("evolution_level_pct", 100))
            break
    await db.evolutions.insert_one({
        "id": new_id(),
        "player_pokemon_id": doc["id"],
        "from_species_id": stalled_species,
        "to_species_id": body.target_species_id,
        "at_level": at_level,
        "created_at": now,
    })
    # cascade further evolutions if unambiguous — keep walking
    species = body.target_species_id
    while True:
        kind, payload = resolve_evolutions(
            bundle["root"], species, state["level"],
            project.get("synthetic_evolution_level", 30),
            project.get("evolution_level_pct", 100),
        )
        if kind != "single":
            break
        # add another evolution row
        node2 = find_node(bundle["root"], species) or {"children": []}
        for child in node2.get("children", []):
            if child["node"]["species_id"] == payload:
                from engine import effective_gate
                at_level_2 = effective_gate(child["details"], project.get("synthetic_evolution_level", 30), project.get("evolution_level_pct", 100))
                await db.evolutions.insert_one({
                    "id": new_id(),
                    "player_pokemon_id": doc["id"],
                    "from_species_id": species,
                    "to_species_id": payload,
                    "at_level": at_level_2,
                    "created_at": now_iso(),
                })
                break
        species = payload
    await db.player_pokemon.update_one(
        {"id": doc["id"]},
        {"$set": {"current_species_id": species, "pending_evolution": False}},
    )
    state2 = await _get_pokemon_state(project_id, uid)
    return {"pokemon": state2}


@router.post("/{project_id}/prestige")
async def prestige(project_id: str, body: StarterPick, uid: str = Depends(current_user_id)):
    db = get_db()
    from server import pokeapi
    project, _ = await assert_project_access(project_id, uid)
    if body.species_id not in STARTER_IDS:
        raise HTTPException(status_code=400, detail="Not a valid starter")
    doc = await db.player_pokemon.find_one({"project_id": project_id, "user_id": uid})
    if not doc:
        raise HTTPException(status_code=404, detail="No partner")
    bundle = await _species_bundle(pokeapi, doc["base_species_id"])
    ledger = await db.xp_events.find({"player_pokemon_id": doc["id"]}).to_list(50000)
    state = derive_state(
        ledger=[{"xp_awarded": e["xp_awarded"]} for e in ledger],
        base_species_id=doc["base_species_id"],
        root=bundle["root"],
        growth_table=bundle["growth_table"],
        synthetic_level=project.get("synthetic_evolution_level", 30),
        level_pct=project.get("evolution_level_pct", 100),
        xp_baseline=doc.get("xp_baseline", 0),
    )
    if state["stage_index"] != state["total_stages"] or state["pending_evolution"]:
        raise HTTPException(status_code=400, detail="Only fully evolved Pokémon can prestige")
    is_shiny = random.randint(1, SHINY_CHANCE_DENOM) == 1
    lifetime = state["total_xp"]
    await db.player_pokemon.update_one(
        {"id": doc["id"]},
        {"$set": {
            "base_species_id": body.species_id,
            "current_species_id": body.species_id,
            "is_shiny": is_shiny,
            "prestige": doc.get("prestige", 0) + 1,
            "xp_baseline": lifetime,
            "level": 1,
            "stage_index": 0,
            "pending_evolution": False,
        }},
    )
    # Clear evolutions history
    await db.evolutions.delete_many({"player_pokemon_id": doc["id"]})
    state2 = await _get_pokemon_state(project_id, uid)
    return {"pokemon": state2, "is_shiny": is_shiny}


@router.get("/{project_id}/leaderboard")
async def leaderboard(project_id: str, uid: str = Depends(current_user_id)):
    db = get_db()
    from server import pokeapi
    project, _ = await assert_project_access(project_id, uid)
    team_id = project["team_id"]
    memberships = await db.memberships.find({"team_id": team_id}).to_list(1000)
    users = await db.users.find({"id": {"$in": [m["user_id"] for m in memberships]}}).to_list(1000)
    umap = {u["id"]: u for u in users}
    rows = []
    for m in memberships:
        u = umap.get(m["user_id"])
        if not u:
            continue
        pm = await db.player_pokemon.find_one({"project_id": project_id, "user_id": u["id"]})
        if pm:
            bundle = await _species_bundle(pokeapi, pm["base_species_id"])
            ledger = await db.xp_events.find({"player_pokemon_id": pm["id"]}).to_list(50000)
            state = derive_state(
                ledger=[{"xp_awarded": e["xp_awarded"]} for e in ledger],
                base_species_id=pm["base_species_id"],
                root=bundle["root"],
                growth_table=bundle["growth_table"],
                synthetic_level=project.get("synthetic_evolution_level", 30),
                level_pct=project.get("evolution_level_pct", 100),
                xp_baseline=pm.get("xp_baseline", 0),
            )
            data = await _pokemon_data(pokeapi, state["current_species_id"])
            rows.append({
                "user_id": u["id"],
                "user_name": u["name"],
                "user_email": u["email"],
                "level": state["level"],
                "total_xp": state["total_xp"],
                "sprite_url": (data["shiny_sprite"] if pm.get("is_shiny") else data["sprite"]),
                "species_name": data["name"],
                "is_shiny": pm.get("is_shiny", False),
                "prestige": pm.get("prestige", 0),
                "types": data["types"],
            })
        else:
            rows.append({
                "user_id": u["id"],
                "user_name": u["name"],
                "user_email": u["email"],
                "level": 0,
                "total_xp": 0,
                "sprite_url": None,
                "species_name": None,
                "is_shiny": False,
                "prestige": 0,
                "types": [],
            })
    # Sort by (total_xp desc, level desc)
    rows.sort(key=lambda r: (r["total_xp"], r["level"]), reverse=True)
    # Competition ranking (1,1,3)
    rank = 0
    last = None
    for i, r in enumerate(rows):
        if last is None or r["total_xp"] != last["total_xp"] or r["level"] != last["level"]:
            rank = i + 1
        r["rank"] = rank
        last = r
    return rows
