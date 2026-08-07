"""Ticket CRUD + XP ledger writes on Done transitions."""
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from auth import current_user_id
from database import get_db
from models import FIBONACCI_POINTS, TicketCreate, TicketOut, TicketUpdate, new_id, now_iso
from routes_projects import assert_project_access

router = APIRouter(prefix="/projects", tags=["tickets"])


def _ticket_out(t: Dict[str, Any]) -> Dict[str, Any]:
    return TicketOut(
        id=t["id"],
        project_id=t["project_id"],
        title=t["title"],
        description=t.get("description", ""),
        story_points=t["story_points"],
        status=t["status"],
        assignee_id=t.get("assignee_id"),
        completed_by_id=t.get("completed_by_id"),
        completed_at=t.get("completed_at"),
        created_at=t.get("created_at", now_iso()),
    ).model_dump()


async def _ensure_team_member(project: Dict[str, Any], user_id: str) -> None:
    db = get_db()
    m = await db.memberships.find_one({"team_id": project["team_id"], "user_id": user_id})
    if not m:
        raise HTTPException(status_code=400, detail="Assignee is not a team member")


async def _award_xp_for_ticket(project: Dict[str, Any], ticket: Dict[str, Any], completer_id: str) -> None:
    """Write an award event to the ledger, crediting the completer."""
    db = get_db()
    xp = int(ticket["story_points"]) * int(project.get("xp_per_point", 10))
    # find (or create) the completer's player_pokemon — but the spec forces starter pick first,
    # so this should always exist. If not, we simply skip (nothing to credit against).
    pm = await db.player_pokemon.find_one({"project_id": project["id"], "user_id": completer_id})
    if not pm:
        return
    await db.xp_events.insert_one({
        "id": new_id(),
        "player_pokemon_id": pm["id"],
        "ticket_id": ticket["id"],
        "kind": "award",
        "points": int(ticket["story_points"]),
        "xp_awarded": xp,
        "created_at": now_iso(),
    })


async def _reverse_xp_for_ticket(project: Dict[str, Any], ticket_id: str) -> None:
    """Reverse any prior awards for this ticket (drives contribution to 0)."""
    db = get_db()
    events = await db.xp_events.find({"ticket_id": ticket_id}).to_list(1000)
    if not events:
        return
    # Only consider still-outstanding contribution
    per_player: Dict[str, int] = {}
    for e in events:
        per_player[e["player_pokemon_id"]] = per_player.get(e["player_pokemon_id"], 0) + int(e["xp_awarded"])
    for pm_id, outstanding in per_player.items():
        if outstanding == 0:
            continue
        await db.xp_events.insert_one({
            "id": new_id(),
            "player_pokemon_id": pm_id,
            "ticket_id": ticket_id,
            "kind": "reversal",
            "points": 0,
            "xp_awarded": -outstanding,
            "created_at": now_iso(),
        })


async def _adjust_xp_for_ticket(project: Dict[str, Any], ticket_id: str, new_points: int, completer_id: str | None) -> None:
    """Adjust the ticket's cumulative XP to match new_points * xp_per_point."""
    db = get_db()
    xp_per_point = int(project.get("xp_per_point", 10))
    target_xp = int(new_points) * xp_per_point
    events = await db.xp_events.find({"ticket_id": ticket_id}).to_list(1000)
    # If never awarded (e.g., ticket is in backlog), nothing to adjust
    if not events:
        return
    per_player: Dict[str, int] = {}
    for e in events:
        per_player[e["player_pokemon_id"]] = per_player.get(e["player_pokemon_id"], 0) + int(e["xp_awarded"])
    # Ledger credit lives with the completer's mon; use the largest current contributor.
    # Simplest safe approach: adjust each player back to target/n where n=1 (single completer typical).
    # We keep it simple: sum current contributions, then write one adjustment per known contributor.
    for pm_id, outstanding in per_player.items():
        diff = target_xp - outstanding
        if diff == 0:
            continue
        await db.xp_events.insert_one({
            "id": new_id(),
            "player_pokemon_id": pm_id,
            "ticket_id": ticket_id,
            "kind": "adjustment",
            "points": int(new_points),
            "xp_awarded": diff,
            "created_at": now_iso(),
        })


@router.get("/{project_id}/tickets")
async def list_tickets(project_id: str, uid: str = Depends(current_user_id)):
    db = get_db()
    await assert_project_access(project_id, uid)
    tickets = await db.tickets.find({"project_id": project_id}).sort("created_at", 1).to_list(5000)
    return [_ticket_out(t) for t in tickets]


@router.post("/{project_id}/tickets")
async def create_ticket(project_id: str, body: TicketCreate, uid: str = Depends(current_user_id)):
    db = get_db()
    project, _ = await assert_project_access(project_id, uid)
    if body.story_points not in FIBONACCI_POINTS:
        raise HTTPException(status_code=400, detail=f"Story points must be one of {sorted(FIBONACCI_POINTS)}")
    if body.assignee_id:
        await _ensure_team_member(project, body.assignee_id)
    tid = new_id()
    doc = {
        "id": tid,
        "project_id": project_id,
        "title": body.title.strip(),
        "description": (body.description or "").strip(),
        "story_points": int(body.story_points),
        "status": body.status,
        "assignee_id": body.assignee_id,
        "completed_by_id": None,
        "completed_at": None,
        "created_by": uid,
        "created_at": now_iso(),
    }
    if body.status == "done":
        doc["completed_by_id"] = uid
        doc["completed_at"] = now_iso()
    await db.tickets.insert_one(doc)
    if doc["status"] == "done":
        await _award_xp_for_ticket(project, doc, uid)
    return _ticket_out(doc)


@router.patch("/{project_id}/tickets/{ticket_id}")
async def update_ticket(project_id: str, ticket_id: str, body: TicketUpdate, uid: str = Depends(current_user_id)):
    db = get_db()
    project, _ = await assert_project_access(project_id, uid)
    ticket = await db.tickets.find_one({"id": ticket_id, "project_id": project_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    updates: Dict[str, Any] = {}
    if body.title is not None:
        updates["title"] = body.title.strip()
    if body.description is not None:
        updates["description"] = body.description.strip()
    new_points = None
    if body.story_points is not None:
        if body.story_points not in FIBONACCI_POINTS:
            raise HTTPException(status_code=400, detail="Story points must be Fibonacci")
        updates["story_points"] = int(body.story_points)
        new_points = int(body.story_points)
    if body.assignee_id is not None:
        if body.assignee_id:
            await _ensure_team_member(project, body.assignee_id)
        updates["assignee_id"] = body.assignee_id or None
    status_change = None
    if body.status is not None and body.status != ticket["status"]:
        updates["status"] = body.status
        status_change = (ticket["status"], body.status)
        if body.status == "done":
            updates["completed_by_id"] = uid
            updates["completed_at"] = now_iso()
        elif ticket["status"] == "done":
            updates["completed_by_id"] = None
            updates["completed_at"] = None
    if updates:
        await db.tickets.update_one({"id": ticket_id}, {"$set": updates})
    # Ledger effects
    if status_change is not None:
        old, new = status_change
        if new == "done" and old != "done":
            merged = {**ticket, **updates}
            await _award_xp_for_ticket(project, merged, uid)
        elif old == "done" and new != "done":
            await _reverse_xp_for_ticket(project, ticket_id)
    elif new_points is not None and ticket["status"] == "done":
        # only adjust XP if it's already Done
        merged = {**ticket, **updates}
        completer = merged.get("completed_by_id") or uid
        await _adjust_xp_for_ticket(project, ticket_id, new_points, completer)
    updated = await db.tickets.find_one({"id": ticket_id})
    return _ticket_out(updated)


@router.delete("/{project_id}/tickets/{ticket_id}")
async def delete_ticket(project_id: str, ticket_id: str, uid: str = Depends(current_user_id)):
    db = get_db()
    project, _ = await assert_project_access(project_id, uid)
    ticket = await db.tickets.find_one({"id": ticket_id, "project_id": project_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket["status"] == "done":
        await _reverse_xp_for_ticket(project, ticket_id)
    await db.tickets.delete_one({"id": ticket_id})
    return {"ok": True}
