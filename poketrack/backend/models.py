"""Pydantic models used across the API."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

FIBONACCI_POINTS = {1, 2, 3, 5, 8, 13}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# -------- Users --------
class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str = Field(min_length=6, max_length=200)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    avatar_url: Optional[str] = None


# -------- Teams --------
class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class TeamUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class TeamOut(BaseModel):
    id: str
    name: str
    owner_id: str
    my_role: Optional[Literal["owner", "member"]] = None


class MemberOut(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    role: Literal["owner", "member"]


# -------- Invites --------
class InviteCreate(BaseModel):
    email: EmailStr


class InviteOut(BaseModel):
    id: str
    team_id: str
    email: EmailStr
    token: str
    status: Literal["pending", "accepted", "revoked", "expired"]
    invited_by: str
    expires_at: str


# -------- Projects --------
class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    xp_per_point: Optional[int] = Field(default=None, ge=1, le=1000)
    synthetic_evolution_level: Optional[int] = Field(default=None, ge=1, le=100)
    evolution_level_pct: Optional[int] = Field(default=None, ge=10, le=400)


class ProjectOut(BaseModel):
    id: str
    team_id: str
    name: str
    xp_per_point: int
    synthetic_evolution_level: int
    evolution_level_pct: int


# -------- Tickets --------
TicketStatus = Literal["backlog", "in_progress", "done"]


class TicketCreate(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    description: Optional[str] = Field(default="", max_length=4000)
    story_points: int
    assignee_id: Optional[str] = None
    status: TicketStatus = "backlog"


class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    story_points: Optional[int] = None
    assignee_id: Optional[str] = None
    status: Optional[TicketStatus] = None


class TicketOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: str
    story_points: int
    status: TicketStatus
    assignee_id: Optional[str] = None
    completed_by_id: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str


# -------- Starter picker --------
class StarterPick(BaseModel):
    species_id: int


class PokemonState(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_id: str
    user_id: str
    base_species_id: int
    current_species_id: int
    level: int
    total_xp: int
    mon_xp: int
    stage_index: int
    total_stages: int
    pending_evolution: bool
    pending_options: List[int] = Field(default_factory=list)
    is_shiny: bool = False
    prestige: int = 0
    xp_baseline: int = 0
    sprite_url: str
    shiny_sprite_url: str
    species_name: str
    types: List[str] = Field(default_factory=list)
    evolutions_history: List[dict] = Field(default_factory=list)
    xp_progress_current: int = 0
    xp_progress_needed: int = 0
    next_hint: dict = Field(default_factory=dict)


class ChooseEvolutionRequest(BaseModel):
    target_species_id: int
