"""Projects + settings routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from auth import current_user_id
from database import get_db
from models import ProjectCreate, ProjectOut, ProjectUpdate, new_id, now_iso
from routes_teams import assert_member

router = APIRouter(prefix="", tags=["projects"])


DEFAULTS = {"xp_per_point": 10, "synthetic_evolution_level": 30, "evolution_level_pct": 100}


def _project_out(p: dict) -> dict:
    return ProjectOut(
        id=p["id"],
        team_id=p["team_id"],
        name=p["name"],
        xp_per_point=p.get("xp_per_point", DEFAULTS["xp_per_point"]),
        synthetic_evolution_level=p.get("synthetic_evolution_level", DEFAULTS["synthetic_evolution_level"]),
        evolution_level_pct=p.get("evolution_level_pct", DEFAULTS["evolution_level_pct"]),
    ).model_dump()


async def assert_project_access(project_id: str, user_id: str, require_owner: bool = False) -> tuple[dict, dict]:
    db = get_db()
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    membership = await assert_member(project["team_id"], user_id, require_owner=require_owner)
    return project, membership


@router.get("/teams/{team_id}/projects")
async def list_team_projects(team_id: str, uid: str = Depends(current_user_id)):
    db = get_db()
    await assert_member(team_id, uid)
    projects = await db.projects.find({"team_id": team_id}).to_list(1000)
    return [_project_out(p) for p in projects]


@router.post("/teams/{team_id}/projects")
async def create_project(team_id: str, body: ProjectCreate, uid: str = Depends(current_user_id)):
    db = get_db()
    await assert_member(team_id, uid)
    pid = new_id()
    doc = {
        "id": pid,
        "team_id": team_id,
        "name": body.name.strip(),
        "xp_per_point": DEFAULTS["xp_per_point"],
        "synthetic_evolution_level": DEFAULTS["synthetic_evolution_level"],
        "evolution_level_pct": DEFAULTS["evolution_level_pct"],
        "created_by": uid,
        "created_at": now_iso(),
    }
    await db.projects.insert_one(doc)
    return _project_out(doc)


@router.get("/projects/{project_id}")
async def get_project(project_id: str, uid: str = Depends(current_user_id)):
    project, _ = await assert_project_access(project_id, uid)
    return _project_out(project)


@router.patch("/projects/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate, uid: str = Depends(current_user_id)):
    db = get_db()
    project, _ = await assert_project_access(project_id, uid, require_owner=True)
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "name" in updates:
        updates["name"] = updates["name"].strip()
    if updates:
        await db.projects.update_one({"id": project_id}, {"$set": updates})
    project = await db.projects.find_one({"id": project_id})
    return _project_out(project)


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, confirm_name: str, uid: str = Depends(current_user_id)):
    db = get_db()
    project, _ = await assert_project_access(project_id, uid, require_owner=True)
    if confirm_name.strip() != project["name"]:
        raise HTTPException(status_code=400, detail="Project name confirmation does not match")
    await db.projects.delete_one({"id": project_id})
    # Cascade cleanup: tickets, player_pokemon, xp_events (via player ids), evolutions
    player_ids = [p["id"] async for p in db.player_pokemon.find({"project_id": project_id})]
    await db.tickets.delete_many({"project_id": project_id})
    if player_ids:
        await db.xp_events.delete_many({"player_pokemon_id": {"$in": player_ids}})
        await db.evolutions.delete_many({"player_pokemon_id": {"$in": player_ids}})
    await db.player_pokemon.delete_many({"project_id": project_id})
    return {"ok": True}
