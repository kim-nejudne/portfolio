"""Team + membership + invite routes."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from auth import current_user_id
from database import get_db
from models import (
    InviteCreate,
    MemberOut,
    TeamCreate,
    TeamUpdate,
    TeamOut,
    new_id,
    now_iso,
)

router = APIRouter(prefix="/teams", tags=["teams"])


async def assert_member(team_id: str, user_id: str, require_owner: bool = False) -> dict:
    db = get_db()
    membership = await db.memberships.find_one({"team_id": team_id, "user_id": user_id})
    if not membership:
        raise HTTPException(status_code=403, detail="Not a team member")
    if require_owner and membership.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Owner only")
    return membership


@router.get("")
async def list_teams(uid: str = Depends(current_user_id)):
    db = get_db()
    memberships = await db.memberships.find({"user_id": uid}).to_list(1000)
    team_ids = [m["team_id"] for m in memberships]
    role_map = {m["team_id"]: m["role"] for m in memberships}
    teams = await db.teams.find({"id": {"$in": team_ids}}).to_list(1000)
    return [
        TeamOut(id=t["id"], name=t["name"], owner_id=t["owner_id"], my_role=role_map.get(t["id"])).model_dump()
        for t in teams
    ]


@router.post("")
async def create_team(body: TeamCreate, uid: str = Depends(current_user_id)):
    db = get_db()
    tid = new_id()
    await db.teams.insert_one({"id": tid, "name": body.name.strip(), "owner_id": uid, "created_at": now_iso()})
    await db.memberships.insert_one(
        {"team_id": tid, "user_id": uid, "role": "owner", "created_at": now_iso()}
    )
    return TeamOut(id=tid, name=body.name.strip(), owner_id=uid, my_role="owner").model_dump()


@router.get("/{team_id}")
async def get_team(team_id: str, uid: str = Depends(current_user_id)):
    db = get_db()
    await assert_member(team_id, uid)
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    my = await db.memberships.find_one({"team_id": team_id, "user_id": uid})
    return TeamOut(id=team["id"], name=team["name"], owner_id=team["owner_id"], my_role=(my or {}).get("role")).model_dump()


@router.patch("/{team_id}")
async def update_team(team_id: str, body: TeamUpdate, uid: str = Depends(current_user_id)):
    db = get_db()
    await assert_member(team_id, uid, require_owner=True)
    await db.teams.update_one({"id": team_id}, {"$set": {"name": body.name.strip()}})
    team = await db.teams.find_one({"id": team_id})
    return TeamOut(id=team["id"], name=team["name"], owner_id=team["owner_id"], my_role="owner").model_dump()


@router.get("/{team_id}/members")
async def list_members(team_id: str, uid: str = Depends(current_user_id)) -> List[dict]:
    db = get_db()
    await assert_member(team_id, uid)
    memberships = await db.memberships.find({"team_id": team_id}).to_list(1000)
    user_ids = [m["user_id"] for m in memberships]
    users = await db.users.find({"id": {"$in": user_ids}}).to_list(1000)
    umap = {u["id"]: u for u in users}
    out: List[dict] = []
    for m in memberships:
        u = umap.get(m["user_id"])
        if not u:
            continue
        out.append(
            MemberOut(user_id=u["id"], email=u["email"], name=u["name"], role=m["role"]).model_dump()
        )
    return out


# ---------------- Invites ----------------

@router.get("/{team_id}/invites")
async def list_invites(team_id: str, uid: str = Depends(current_user_id)):
    db = get_db()
    await assert_member(team_id, uid, require_owner=True)
    invites = await db.invites.find({"team_id": team_id, "status": "pending"}).to_list(1000)
    return [
        {
            "id": i["id"], "team_id": i["team_id"], "email": i["email"], "token": i["token"],
            "status": i["status"], "invited_by": i["invited_by"], "expires_at": i["expires_at"],
        } for i in invites
    ]


@router.post("/{team_id}/invites")
async def create_invite(team_id: str, body: InviteCreate, uid: str = Depends(current_user_id)):
    db = get_db()
    await assert_member(team_id, uid, require_owner=True)
    email = body.email.lower()
    # already a member?
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        m = await db.memberships.find_one({"team_id": team_id, "user_id": existing_user["id"]})
        if m:
            raise HTTPException(status_code=400, detail="User is already a team member")
    # existing pending invite? dedupe
    existing = await db.invites.find_one({"team_id": team_id, "email": email, "status": "pending"})
    if existing:
        return {
            "id": existing["id"], "team_id": team_id, "email": email, "token": existing["token"],
            "status": "pending", "invited_by": existing["invited_by"], "expires_at": existing["expires_at"],
        }
    token = secrets.token_urlsafe(24)
    expires = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
    doc = {
        "id": new_id(), "team_id": team_id, "email": email, "token": token,
        "status": "pending", "invited_by": uid, "expires_at": expires,
        "created_at": now_iso(),
    }
    await db.invites.insert_one(doc)
    return {"id": doc["id"], "team_id": team_id, "email": email, "token": token, "status": "pending", "invited_by": uid, "expires_at": expires}


@router.post("/{team_id}/invites/{invite_id}/revoke")
async def revoke_invite(team_id: str, invite_id: str, uid: str = Depends(current_user_id)):
    db = get_db()
    await assert_member(team_id, uid, require_owner=True)
    inv = await db.invites.find_one({"id": invite_id, "team_id": team_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Invite not found")
    if inv["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending invites can be revoked")
    await db.invites.update_one({"id": invite_id}, {"$set": {"status": "revoked"}})
    return {"ok": True}


# ---------- Public routes for invite acceptance (mounted separately) ----------

invite_router = APIRouter(prefix="/invites", tags=["invites"])


@invite_router.get("/{token}")
async def peek_invite(token: str):
    db = get_db()
    inv = await db.invites.find_one({"token": token})
    if not inv:
        return {"status": "invalid"}
    if inv["status"] != "pending":
        return {"status": inv["status"], "email": inv["email"], "team_id": inv["team_id"]}
    # check expiry
    if inv.get("expires_at") and datetime.fromisoformat(inv["expires_at"]) < datetime.now(timezone.utc):
        await db.invites.update_one({"id": inv["id"]}, {"$set": {"status": "expired"}})
        return {"status": "expired", "email": inv["email"], "team_id": inv["team_id"]}
    team = await db.teams.find_one({"id": inv["team_id"]})
    return {
        "status": "pending",
        "email": inv["email"],
        "team_id": inv["team_id"],
        "team_name": (team or {}).get("name", "a team"),
    }


@invite_router.post("/{token}/accept")
async def accept_invite(token: str, uid: str = Depends(current_user_id)):
    db = get_db()
    inv = await db.invites.find_one({"token": token})
    if not inv:
        raise HTTPException(status_code=404, detail="Invite not found")
    user = await db.users.find_one({"id": uid})
    if not user:
        raise HTTPException(status_code=401, detail="Not signed in")
    if inv["status"] == "revoked":
        raise HTTPException(status_code=400, detail="Invite revoked")
    if inv["status"] == "expired":
        raise HTTPException(status_code=400, detail="Invite expired")
    if inv.get("expires_at") and datetime.fromisoformat(inv["expires_at"]) < datetime.now(timezone.utc):
        await db.invites.update_one({"id": inv["id"]}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Invite expired")
    if user["email"].lower() != inv["email"].lower():
        raise HTTPException(
            status_code=400,
            detail=f"Invite is for {inv['email']}; you are signed in as {user['email']}",
        )
    # Idempotent accept: if already member, still mark invite accepted
    existing = await db.memberships.find_one({"team_id": inv["team_id"], "user_id": uid})
    if not existing:
        await db.memberships.insert_one(
            {"team_id": inv["team_id"], "user_id": uid, "role": "member", "created_at": now_iso()}
        )
    if inv["status"] == "pending":
        await db.invites.update_one({"id": inv["id"]}, {"$set": {"status": "accepted"}})
    return {"ok": True, "team_id": inv["team_id"]}
