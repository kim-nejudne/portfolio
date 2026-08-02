"""Build the demo world recruiters land in.

Run it as often as you like — it wipes everything reachable from a demo user
and rebuilds from scratch:

    MONGO_URL=... DB_NAME=poketrack python seed_demo.py

Two things make it safe to re-run on a live box.

**Ids are derived, not random.** Every id is a uuid5 of a stable key, so a
reseed hands the same user, team and project the same id it had before. Bearer
tokens carry the user id in `sub`, so a recruiter mid-session is not signed out
by the nightly reset, and bookmarked project URLs keep resolving.

**Only demo data is touched.** The wipe walks out from users marked `is_demo`
and takes their teams, projects, tickets, partners and ledger with them —
including anything a visitor created while clicking around, which carries no
demo marker of its own. A team a demo user merely *joined* is left alone; only
teams a demo user owns are deleted.

XP is not written as a number anywhere. Levels here are derived the same way
they are in the app — `SUM(xp_events.xp_awarded)` fed through the real PokéAPI
growth curve. To park a trainer at level 35 the seed asks the growth table what
level 35 costs, converts that to story points, and issues exactly enough Done
tickets to pay for it. Delete a ticket in the UI and the level really does fall.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple

import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

from engine import build_growth_table, level_from_xp
from pokeapi_service import PokeApi

# Fixed namespace so ids survive a reseed. Do not change it — doing so orphans
# every bookmarked URL and invalidates every outstanding demo token.
DEMO_NS = uuid.UUID("6f1d2a7e-3c48-5b90-a1e2-7d4c0b8f9a31")

# One seed for the whole world, so two runs produce byte-identical filler.
RNG_SEED = 20260802

# Shared by every demo login. Deliberately guessable — it is printed on the
# sign-in page. Non-login trainers get an unguessable one they never use.
DEMO_PASSWORD = "pokedemo"

# bcrypt at the default cost would spend ~15s hashing this many users for
# accounts whose passwords are public anyway.
BCRYPT_ROUNDS = 6

# The board is dated backwards from "now" so it reads as a project in flight
# rather than one that sprang into being at 03:15 UTC.
HISTORY_DAYS = 112


def did(kind: str, key: str) -> str:
    """Deterministic id for a demo document."""
    return str(uuid.uuid5(DEMO_NS, f"poketrack-demo:{kind}:{key}"))


# --------------------------------------------------------------------------
# Cast
# --------------------------------------------------------------------------
# `login` entries surface on the sign-in page as one-click buttons. The rest
# exist to give the leaderboard a real spread — nobody signs in as them.

USERS: List[Dict[str, Any]] = [
    {
        "key": "rina",
        "name": "Rina Halvorsen",
        "email": "owner@poketrack.dev",
        "login": True,
        "role_label": "Team owner",
        "blurb": "Runs Meridian Labs. Sees project settings, invites and every board. "
                 "Her Charmeleon is one ticket short of Charizard.",
        "order": 1,
    },
    {
        "key": "marcus",
        "name": "Marcus Oyelaran",
        "email": "dev@poketrack.dev",
        "login": True,
        "role_label": "Engineer",
        "blurb": "An Eevee stalled at level 31 with all eight branches unlocked — "
                 "the evolution choice fires the moment you open the board.",
        "order": 2,
    },
    {
        "key": "june",
        "name": "June Castellanos",
        "email": "new@poketrack.dev",
        "login": True,
        "role_label": "New joiner",
        "blurb": "Just landed on the flagship project with no partner yet. "
                 "Starts at the starter picker, from zero.",
        "order": 3,
    },
    {"key": "theo", "name": "Theo Lindqvist", "email": "theo.lindqvist@meridianlabs.example"},
    {"key": "priya", "name": "Priya Raghunathan", "email": "priya.raghunathan@meridianlabs.example"},
    {"key": "sam", "name": "Sam Okonkwo", "email": "sam.okonkwo@meridianlabs.example"},
    {"key": "yuki", "name": "Yuki Tanabe", "email": "yuki.tanabe@meridianlabs.example"},
    {"key": "nadia", "name": "Nadia Ferreira", "email": "nadia.ferreira@nightjar.example"},
    {"key": "oliver", "name": "Oliver Brandt", "email": "oliver.brandt@nightjar.example"},
    {"key": "zara", "name": "Zara Malik", "email": "zara.malik@nightjar.example"},
]

TEAMS: List[Dict[str, Any]] = [
    {
        "key": "meridian",
        "name": "Meridian Labs",
        "owner": "rina",
        "members": ["marcus", "june", "theo", "priya", "sam", "yuki"],
    },
    {
        "key": "nightjar",
        "name": "Nightjar Studio",
        "owner": "marcus",
        "members": ["rina", "nadia", "oliver", "zara"],
    },
    {
        "key": "solo",
        "name": "Solo Lab",
        "owner": "rina",
        "members": ["june"],
    },
]

# Pending invites, so the team settings screen is not an empty table.
INVITES: List[Dict[str, Any]] = [
    {"team": "meridian", "email": "hana.iwasaki@meridianlabs.example", "by": "rina", "days_ago": 3},
    {"team": "meridian", "email": "dev.contractor@partner.example", "by": "rina", "days_ago": 9},
    {"team": "nightjar", "email": "freelance.motion@nightjar.example", "by": "marcus", "days_ago": 1},
]


# --------------------------------------------------------------------------
# Ticket copy
# --------------------------------------------------------------------------
# Hand-written per project so the board reads like somebody's actual backlog.
# Each project draws from its own pool first and tops up from FILLER.

TITLES: Dict[str, List[str]] = {
    "checkout": [
        "Split the one-page checkout into address / delivery / pay",
        "Persist the cart across sign-in so guests don't lose it",
        "Idempotency keys on POST /orders",
        "Handle 3-D Secure step-up without losing form state",
        "Inline card validation — stop waiting for the gateway to say no",
        "Apple Pay / Google Pay sheet on the payment step",
        "Tax is computed twice on the review step",
        "Address autocomplete falls back to manual entry offline",
        "Retry the gateway on 502 with jittered backoff",
        "Order confirmation email is missing the VAT breakdown",
        "Guest checkout: don't force an account at the end",
        "Coupon stacking rules are inconsistent with the admin",
        "Saved cards list shows expired cards without a warning",
        "Move the price formatter into one module",
        "Checkout abandonment funnel events",
        "Keyboard trap in the country select on Safari",
        "Shipping estimate flickers while the quote is in flight",
        "Currency rounding drifts by a cent on multi-item carts",
        "Decommission the legacy /cart/finalise endpoint",
        "Rate-limit the promo-code endpoint",
        "Card form is unusable at 320px",
        "Screen reader announces the total before it updates",
        "Timeout the payment poll after 90s and show a real message",
        "Contract test against the gateway sandbox in CI",
    ],
    "mobile": [
        "Offline-first sync for the activity feed",
        "Push notification deep links land on the wrong tab",
        "Cold start is 4.2s on a Pixel 4a",
        "Biometric unlock on returning sessions",
        "Pull-to-refresh fights the parent scroll view",
        "Image cache grows without bound",
        "Dark mode misses the bottom sheet",
        "Crash on rotate while a modal is open",
        "Replace the bespoke nav stack with the platform one",
        "Token refresh races on app resume",
        "Haptics on the primary action",
        "Tablet layout collapses at 600dp",
        "Migrate the local store off the deprecated adapter",
        "Analytics events fire twice on the onboarding screen",
        "Skeleton states for the profile screen",
        "Handle notification permission denial gracefully",
        "Background fetch drains battery on iOS 18",
        "Ship the accessibility audit fixes for VoiceOver",
        "Version gate the API client",
        "Reduce the bundle by tree-shaking the icon set",
    ],
    "design-system": [
        "Tokenise the colour ramp — stop hardcoding hex",
        "Button: consolidate seven variants into three",
        "Focus rings fail contrast on the amber surface",
        "Publish the package to the internal registry",
        "Document the spacing scale with real examples",
        "Modal traps focus but not the escape key",
        "Type scale is not fluid between 640 and 1024",
        "Icon set: ship an SVG sprite instead of per-icon components",
        "Table component has no empty state",
        "Toast stacking order is undefined with three or more",
        "Motion tokens honour prefers-reduced-motion",
        "Form field: bind label, hint and error with aria-describedby",
        "Visual regression snapshots in CI",
        "Deprecate the v1 Card and write the codemod",
        "Dark theme contrast audit",
        "Tooltip does not open on keyboard focus",
        "Storybook build is 90s — split the chunks",
    ],
    "payments": [
        "Dual-write to the new ledger behind a flag",
        "Backfill 2024 settlements into the new schema",
        "Reconciliation job disagrees by 3 cents on refunds",
        "Idempotent webhook handler for provider retries",
        "Partial refunds against split-tender orders",
        "Payout schedule is off by a day across DST",
        "Cut over read traffic to the new ledger",
        "Store amounts as integer minor units everywhere",
        "Provider webhook signature verification",
        "Dead-letter queue for unprocessable events",
        "Chargeback flow has no operator UI",
        "Currency conversion uses the rate at capture, not at authorisation",
        "Delete the legacy ledger tables",
        "Runbook for a failed settlement batch",
        "Alert when the reconciliation delta exceeds a cent",
        "Load test the ledger writer at 200 tps",
    ],
    "aurora": [
        "Hero: kinetic type that survives a reflow",
        "Scroll-linked section transitions at 60fps",
        "Programme grid — 16 weeks without a scroll jail",
        "Replace the carousel with a snap scroller",
        "Reduced-motion variant for the whole page",
        "Self-host the variable font and drop the CDN",
        "Lighthouse is 61 on mobile — find the LCP",
        "SVG line-draw on the strength chart",
        "Sticky nav overlaps the section anchors",
        "Pricing table is unreadable on a 360px phone",
        "Copy pass on the programme descriptions",
        "OG card generation for social",
        "Cumulative layout shift from the hero image",
        "Testimonial marquee pauses on hover and focus",
        "Ship the 404 page",
    ],
    "tallow": [
        "Reservation flow: hold the slot while the form is open",
        "Menu prices render as whole pesos, no decimals",
        "Dish of the day admin control",
        "Inventory count goes negative on concurrent edits",
        "Staff sign-in rate limiting",
        "Read-only demo role for the admin",
        "Table availability query is O(n) per slot",
        "Email confirmation copy needs a rewrite",
        "Opening hours are hardcoded in three places",
        "Mobile menu is not keyboard reachable",
        "Seed the menu from a migration, not a JSON file",
        "Print stylesheet for the daily prep sheet",
        "Photo lazy-loading pushes the layout around",
        "Cancellation window rules",
    ],
    "tooling": [
        "One command to bring the whole stack up",
        "Preview environments per pull request",
        "Flaky test quarantine with an owner and an expiry",
        "Cut CI from 11 minutes to under 5",
        "Secrets out of the repo and into the vault",
        "Dependency update bot with grouped PRs",
        "Structured logs with a request id",
        "Error budget dashboard",
        "Nightly backup restore rehearsal",
        "Bootstrap script fails on a clean macOS install",
        "Document the on-call rotation",
        "Ship the incident template",
    ],
    "portfolio": [
        "Hub: the head hinges open on scroll",
        "Parallax layers without a single layout thrash",
        "Route-level code splitting for each spoke",
        "Write the case study for the restaurant spoke",
        "Self-host fonts and preload the two that matter",
        "Reduced-motion pass across the hub",
        "Lighthouse 100 on the homepage or it doesn't ship",
        "Spoke cards should tease, not summarise",
        "Deploy the static bundle from the workstation",
        "Alt text for every illustrated layer",
        "Open Graph cards per spoke",
        "Kill the unused Tailwind in the build",
    ],
}

# Cross-cutting work every codebase carries. Used to top a board up.
FILLER: List[str] = [
    "Bump the Node runtime to 22",
    "Flaky test: retries mask a real race",
    "Upgrade the test runner and delete the shims",
    "Sentry is missing source maps for the latest release",
    "Rotate the staging credentials",
    "README is a year out of date",
    "Prune the dead feature flags",
    "Add a CODEOWNERS file",
    "Cache the dependency install in CI",
    "Nightly job silently swallows failures",
    "Health check returns 200 while the database is down",
    "Log lines leak the bearer token",
    "Tighten the CORS allowlist",
    "Container image is 1.4GB — build it in two stages",
    "Pin the base image by digest",
    "Metrics endpoint is unauthenticated",
    "Timezone handling on the reporting query",
    "Delete the abandoned spike branch",
    "Reduce the p95 on the search endpoint",
    "Write the ADR for the queue choice",
]

# A mature board runs to dozens of Done tickets and the hand-written pools run
# dry. Past that point titles are composed from these parts against the
# project's own nouns, so filler still reads as work on *this* codebase.
GEN_ACTIONS: List[str] = [
    "Add a regression test for", "Audit", "Batch the writes behind", "Cache",
    "Debounce", "Deprecate", "Document", "Extract a hook out of",
    "Harden", "Instrument", "Memoise", "Paginate", "Pull the retry logic out of",
    "Put a circuit breaker in front of", "Rate-limit", "Rewrite the error states for",
    "Simplify", "Split", "Tighten the types on", "Trace", "Warm the cache for",
]
GEN_BUGS: List[str] = [
    "double-fires on a slow connection", "swallows the error and renders empty",
    "loses focus after a re-render", "leaks a listener on unmount",
    "renders twice on first paint", "ignores the abort signal",
    "drops the last item when the page is exactly full",
    "throws on an empty response", "keeps a stale value after navigation",
    "blocks the main thread for 300ms", "is unreachable by keyboard",
    "misreports the count when a filter is active",
]
GEN_TAILS: List[str] = [
    "", "", "", " behind a feature flag", " before the next release",
    " on the read path", " without another round trip", " and delete the old path",
    " — measured, not guessed", " for the mobile breakpoint",
]

DESCRIPTIONS: List[str] = [
    "Picked up from the last review. Keep the change surface small — one concern, one PR.",
    "Reproduced on staging. Attach the trace to the PR before asking for review.",
    "Blocked nothing, but it keeps coming back in retro. Worth doing properly this time.",
    "Acceptance: behaviour is covered by a test that fails before the fix and passes after.",
    "Carried over from last sprint. Scope was too broad; this is the narrowed version.",
    "Needs a design check before it ships. Ping the owner in the channel, not in a comment.",
    "There is a workaround in place. Remove it as part of this — do not leave both paths.",
    "Measured, not guessed: include the before and after numbers in the description.",
]


# --------------------------------------------------------------------------
# Projects
# --------------------------------------------------------------------------
# `roster` is what makes each board interesting. Per trainer:
#   species  — the partner's base species (derive_state walks it forward)
#   level    — where they should land, honoured exactly via the growth table
#   frac     — how far into that level, so XP bars are not all at zero
#   shiny    — 1-in-256 in the app; pinned here so the demo reliably has one
#   prestige — resets the mon and banks lifetime XP as `xp_baseline`
#   wip      — guarantees them an In Progress ticket of this size to drag
#
# `xp_per_point` is the lever that makes a level reachable inside a plausible
# backlog. At the app default of 10, Charizard costs 4,000 story points.

PROJECTS: List[Dict[str, Any]] = [
    {
        "key": "checkout",
        "team": "meridian",
        "name": "Checkout Rewrite",
        # Pitched so a level costs a handful of tickets rather than hundreds.
        # The app default of 10 would price Charizard at 4,000 story points.
        # The upper bound is the Done column, which has no scroll of its own —
        # past roughly forty cards the board becomes a very tall page.
        "xp_per_point": 700,
        "synthetic_evolution_level": 30,
        "evolution_level_pct": 100,
        "backlog": 12,
        "in_progress": 5,
        "nouns": [
            "the cart summary", "the address form", "the payment step",
            "the order poller", "the promo-code field", "the delivery picker",
            "the receipt renderer", "the gateway client", "the tax service",
        ],
        "roster": [
            # 39,257 XP against a Charizard gate of 40,007. The 5-point ticket
            # below is the headline: drag it to Done and the cutscene fires.
            {"user": "rina", "species": 4, "level": 35, "frac": 0.72, "wip": 5},
            {"user": "theo", "species": 1, "level": 33, "frac": 0.20},
            {"user": "priya", "species": 7, "level": 30, "frac": 0.60},
            {"user": "sam", "species": 158, "level": 28, "frac": 0.45},
            {"user": "marcus", "species": 7, "level": 27, "frac": 0.30},
            {"user": "yuki", "species": 155, "level": 26, "frac": 0.30, "shiny": True},
            # june is on this team but has no partner here — she lands on the
            # starter picker, which is the entire point of her account. Every
            # other login has a partner on every board they can open.
        ],
    },
    {
        "key": "mobile",
        "team": "meridian",
        "name": "Mobile App v3",
        "xp_per_point": 200,
        "synthetic_evolution_level": 30,
        "evolution_level_pct": 100,
        "backlog": 10,
        "in_progress": 4,
        "nouns": [
            "the activity feed", "the sync worker", "the token refresher",
            "the profile screen", "the bottom sheet", "the image cache",
            "the onboarding flow", "the notification handler",
        ],
        "roster": [
            {"user": "marcus", "species": 393, "level": 24, "frac": 0.40, "wip": 8},
            {"user": "theo", "species": 152, "level": 21, "frac": 0.70},
            {"user": "june", "species": 722, "level": 20, "frac": 0.50},
            {"user": "sam", "species": 255, "level": 19, "frac": 0.15},
            {"user": "rina", "species": 501, "level": 18, "frac": 0.50},
        ],
    },
    {
        "key": "design-system",
        "team": "meridian",
        "name": "Design System",
        "xp_per_point": 250,
        # Gates pulled in to 70%: Fennekin would otherwise reach Delphox at 36,
        # which no plausible backlog pays for. Braixen lands at 11, Delphox 25.
        "synthetic_evolution_level": 26,
        "evolution_level_pct": 70,
        "backlog": 9,
        "in_progress": 4,
        "nouns": [
            "the Button variants", "the colour tokens", "the Modal", "the Table",
            "the Toast stack", "the type scale", "the icon sprite",
            "the form field", "the Storybook build",
        ],
        "roster": [
            # Already Delphox — fully evolved, so the prestige button is live.
            {"user": "yuki", "species": 653, "level": 27, "frac": 0.60},
            # Swampert's gate lands at 25. The 13-point ticket clears it.
            {"user": "priya", "species": 258, "level": 23, "frac": 0.50, "wip": 13},
            {"user": "rina", "species": 498, "level": 21, "frac": 0.30},
            {"user": "marcus", "species": 725, "level": 20, "frac": 0.50},
            {"user": "june", "species": 906, "level": 18, "frac": 0.40},
        ],
    },
    {
        "key": "payments",
        "team": "meridian",
        "name": "Payments Migration",
        "xp_per_point": 320,
        "synthetic_evolution_level": 30,
        "evolution_level_pct": 100,
        "backlog": 9,
        "in_progress": 3,
        "nouns": [
            "the ledger writer", "the reconciliation job", "the webhook handler",
            "the payout scheduler", "the refund path", "the settlement batch",
            "the currency converter", "the dead-letter queue",
        ],
        "roster": [
            # Prestiged once: top of the leaderboard on lifetime XP, level 14 on
            # the current partner. The two numbers disagreeing is the point.
            {"user": "priya", "species": 656, "level": 14, "frac": 0.50,
             "prestige": 1, "banked": 26000},
            {"user": "rina", "species": 495, "level": 29, "frac": 0.55},
            {"user": "marcus", "species": 387, "level": 24, "frac": 0.20},
            {"user": "sam", "species": 650, "level": 22, "frac": 0.80},
            {"user": "june", "species": 728, "level": 15, "frac": 0.40},
        ],
    },
    {
        "key": "aurora",
        "team": "nightjar",
        "name": "Client — Aurora Fitness",
        "xp_per_point": 420,
        # Eevee's eight branches trigger on stones, happiness and affection
        # rather than a level, so every one of them falls back to this number.
        "synthetic_evolution_level": 30,
        "evolution_level_pct": 100,
        "backlog": 9,
        "in_progress": 4,
        "nouns": [
            "the hero type", "the scroll timeline", "the programme grid",
            "the pricing table", "the strength chart", "the sticky nav",
            "the testimonial marquee", "the font loader",
        ],
        "roster": [
            # Not a starter — you cannot pick Eevee through the app. It is
            # seeded because the landing page promises the eight-way branch and
            # this is the only place a visitor can actually see one.
            {"user": "marcus", "species": 133, "level": 31, "frac": 0.35},
            {"user": "nadia", "species": 725, "level": 26, "frac": 0.40, "wip": 8},
            {"user": "zara", "species": 728, "level": 23, "frac": 0.60, "shiny": True},
            {"user": "rina", "species": 390, "level": 22, "frac": 0.40},
        ],
    },
    {
        "key": "tallow",
        "team": "nightjar",
        "name": "Client — Tallow Restaurant",
        "xp_per_point": 110,
        "synthetic_evolution_level": 28,
        "evolution_level_pct": 80,
        "backlog": 8,
        "in_progress": 3,
        "nouns": [
            "the reservation form", "the slot query", "the menu renderer",
            "the inventory counter", "the admin sign-in", "the prep sheet",
            "the confirmation email", "the opening-hours config",
        ],
        "roster": [
            {"user": "oliver", "species": 813, "level": 20, "frac": 0.50},
            {"user": "zara", "species": 810, "level": 18, "frac": 0.20, "wip": 5},
            {"user": "rina", "species": 816, "level": 16, "frac": 0.90},
            {"user": "marcus", "species": 653, "level": 15, "frac": 0.70},
        ],
    },
    {
        "key": "tooling",
        "team": "nightjar",
        "name": "Internal Tooling",
        "xp_per_point": 60,
        "synthetic_evolution_level": 30,
        "evolution_level_pct": 100,
        "backlog": 7,
        "in_progress": 3,
        "nouns": [
            "the bootstrap script", "the CI pipeline", "the preview environments",
            "the secrets loader", "the log formatter", "the backup rehearsal",
            "the dependency bot", "the on-call rota",
        ],
        "roster": [
            {"user": "nadia", "species": 912, "level": 19, "frac": 0.40},
            {"user": "marcus", "species": 909, "level": 17, "frac": 0.60, "wip": 3},
            {"user": "rina", "species": 1, "level": 16, "frac": 0.60},
        ],
    },
    {
        "key": "portfolio",
        "team": "solo",
        "name": "Portfolio Rebuild",
        "xp_per_point": 40,
        "synthetic_evolution_level": 24,
        "evolution_level_pct": 75,
        "backlog": 8,
        "in_progress": 3,
        "nouns": [
            "the hinge animation", "the parallax layers", "the spoke cards",
            "the case-study template", "the font preload", "the OG card job",
            "the reduced-motion pass", "the route splitter",
        ],
        "roster": [
            {"user": "rina", "species": 252, "level": 17, "frac": 0.50, "wip": 8},
            {"user": "june", "species": 387, "level": 12, "frac": 0.30},
        ],
    },
]

FIB = (1, 2, 3, 5, 8, 13)
# Mid-sized tickets dominate a real board; 13s are rare and 1s are chores.
FIB_WEIGHTS = (2, 4, 9, 12, 7, 2)


def fib_split(total_points: int, rng: random.Random) -> List[int]:
    """Break a points budget into Fibonacci-sized tickets, exactly."""
    out: List[int] = []
    remaining = max(0, total_points)
    while remaining > 0:
        allowed = [(f, w) for f, w in zip(FIB, FIB_WEIGHTS) if f <= remaining]
        values = [f for f, _ in allowed]
        weights = [w for _, w in allowed]
        out.append(rng.choices(values, weights=weights, k=1)[0])
        remaining -= out[-1]
    rng.shuffle(out)
    return out


def xp_for(growth_table: List[Tuple[int, int]], level: int, frac: float) -> int:
    """XP that puts a mon at `level`, `frac` of the way to the next one."""
    thresholds = dict(growth_table)
    base = thresholds.get(level)
    if base is None:
        raise ValueError(f"level {level} is not in the growth table")
    nxt = thresholds.get(level + 1)
    if nxt is None:
        return base
    return int(base + (nxt - base) * max(0.0, min(0.95, frac)))


class _Cycle:
    """Deal a shuffled list out in order, reshuffling when it runs dry."""

    def __init__(self, values: List[str], rng: random.Random) -> None:
        self.rng = rng
        self.values = list(values)
        self.order: List[str] = []

    def next(self) -> str:
        if not self.order:
            self.order = list(self.values)
            self.rng.shuffle(self.order)
        return self.order.pop()


class TitleBook:
    """Hands out ticket titles, never the same one twice on a board.

    Three tiers, in order: the project's hand-written pool, the cross-cutting
    chore list, then titles composed from the project's own nouns. A mature
    board needs sixty-odd of them and only the first tier can be hand-written.
    """

    def __init__(self, rng: random.Random) -> None:
        self.rng = rng
        self.filler = list(FILLER)
        rng.shuffle(self.filler)
        self.filler_at = 0
        self.used: set[str] = set()

    def start_project(self, project: Dict[str, Any]) -> None:
        self.pool = list(TITLES.get(project["key"], []))
        self.rng.shuffle(self.pool)
        self.pool_at = 0
        # Each part cycles through a shuffled copy rather than being sampled.
        # Sampling independently reads as generated — three tickets ending
        # "for the mobile breakpoint" turn up on one screen surprisingly often.
        self.parts = {
            name: _Cycle(values, self.rng)
            for name, values in (
                ("noun", project.get("nouns") or ["the service"]),
                ("action", GEN_ACTIONS),
                ("bug", GEN_BUGS),
                ("tail", GEN_TAILS),
            )
        }

    def _compose(self) -> str:
        noun = self.parts["noun"].next()
        if self.rng.random() < 0.3:
            return f"{noun.capitalize()} {self.parts['bug'].next()}"
        return f"{self.parts['action'].next()} {noun}{self.parts['tail'].next()}"

    def next(self) -> str:
        if self.pool_at < len(self.pool):
            self.pool_at += 1
            title = self.pool[self.pool_at - 1]
        elif self.filler_at < len(self.filler):
            self.filler_at += 1
            title = self.filler[self.filler_at - 1]
        else:
            # Composed titles can collide; a bounded retry is enough because
            # the noun x action x tail space is orders of magnitude larger
            # than any one board.
            title = self._compose()
            for _ in range(40):
                if title not in self.used:
                    break
                title = self._compose()
        self.used.add(title)
        return title


def _chain_species(node: Dict[str, Any]) -> List[int]:
    url = (node.get("species") or {}).get("url", "")
    if not url:
        return []
    out = [int([p for p in url.split("/") if p][-1])]
    for child in node.get("evolves_to") or []:
        out.extend(_chain_species(child))
    return out


async def growth_tables(
    pokeapi: PokeApi, species_ids: List[int]
) -> Tuple[Dict[int, List[Tuple[int, int]]], List[int]]:
    """Growth curves, plus every sprite the demo will ask for, into the cache.

    Returns the tables and the species that could not be resolved. The app
    fetches a partner's whole chain on every read, so leaving any of it cold
    means a visitor's first click waits on PokéAPI — or fails outright, because
    `backend/poc/_cache` only carries the 27 starters. Eevee's eight branches in
    particular are not in that fallback: seeding them with no network produces a
    demo whose evolution modal 500s hours later, which is worth saying now
    rather than discovering from a recruiter.
    """
    tables: Dict[int, List[Tuple[int, int]]] = {}
    wanted: set[int] = set()
    unresolved: List[int] = []

    for sid in sorted(set(species_ids)):
        species = await pokeapi.species(sid)
        rate = await pokeapi.growth_rate(species["growth_rate"]["name"])
        tables[sid] = build_growth_table(rate)
        chain_url = species.get("evolution_chain", {}).get("url", "")
        if chain_url:
            chain_id = int([p for p in chain_url.split("/") if p][-1])
            chain = await pokeapi.evolution_chain(chain_id)
            wanted.update(_chain_species(chain.get("chain", {})))

    # PokeApi._prefetch_chain swallows its own failures, which is right for a
    # background prewarm and wrong here — the seed is the last moment anyone is
    # watching. Resolve them one at a time and keep the score.
    for sid in sorted(wanted):
        try:
            await pokeapi.species(sid)
            await pokeapi.pokemon(sid)
        except Exception:  # noqa: BLE001
            unresolved.append(sid)
    return tables, unresolved


async def wipe(db) -> Dict[str, int]:
    """Delete every trace of the demo world, including visitor-made drift.

    Walks out from the demo users rather than matching a `demo` marker, because
    a team or ticket a visitor created while signed in as a demo account has no
    marker of its own and would otherwise accumulate forever.
    """
    demo_users = await db.users.find({"is_demo": True}, {"id": 1}).to_list(1000)
    user_ids = [u["id"] for u in demo_users]
    if not user_ids:
        return {}

    # Only teams a demo user *owns*. One a demo user merely joined belongs to
    # somebody real; drop the membership, leave the team standing.
    teams = await db.teams.find({"owner_id": {"$in": user_ids}}, {"id": 1}).to_list(1000)
    team_ids = [t["id"] for t in teams]

    projects = await db.projects.find({"team_id": {"$in": team_ids}}, {"id": 1}).to_list(1000)
    project_ids = [p["id"] for p in projects]

    mons = await db.player_pokemon.find(
        {"$or": [{"project_id": {"$in": project_ids}}, {"user_id": {"$in": user_ids}}]},
        {"id": 1},
    ).to_list(10000)
    mon_ids = [m["id"] for m in mons]

    counts: Dict[str, int] = {}

    async def drop(collection: str, query: Dict[str, Any]) -> None:
        result = await db[collection].delete_many(query)
        counts[collection] = counts.get(collection, 0) + result.deleted_count

    await drop("xp_events", {"player_pokemon_id": {"$in": mon_ids}})
    await drop("evolutions", {"player_pokemon_id": {"$in": mon_ids}})
    await drop("player_pokemon", {"id": {"$in": mon_ids}})
    await drop("tickets", {"project_id": {"$in": project_ids}})
    await drop("projects", {"id": {"$in": project_ids}})
    await drop("invites", {"team_id": {"$in": team_ids}})
    # Both halves matter: memberships of any demo team, and demo users'
    # memberships of teams that survive.
    await drop("memberships", {"$or": [{"team_id": {"$in": team_ids}},
                                       {"user_id": {"$in": user_ids}}]})
    await drop("teams", {"id": {"$in": team_ids}})
    await drop("users", {"id": {"$in": user_ids}})
    return counts


async def build(db, pokeapi: PokeApi, verbose: bool = True) -> Dict[str, int]:
    rng = random.Random(RNG_SEED)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=HISTORY_DAYS)

    def stamp(dt: datetime) -> str:
        return dt.astimezone(timezone.utc).isoformat()

    # ---- users -----------------------------------------------------------
    filler_hash = bcrypt.hashpw(
        os.urandom(24).hex().encode(), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    ).decode()
    login_hash = bcrypt.hashpw(
        DEMO_PASSWORD.encode(), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    ).decode()

    uid: Dict[str, str] = {}
    user_docs: List[Dict[str, Any]] = []
    for spec in USERS:
        user_id = did("user", spec["key"])
        uid[spec["key"]] = user_id
        is_login = bool(spec.get("login"))
        doc: Dict[str, Any] = {
            "id": user_id,
            "email": spec["email"].lower(),
            "name": spec["name"],
            "avatar_url": None,
            "password_hash": login_hash if is_login else filler_hash,
            "created_at": stamp(start),
            "is_demo": True,
        }
        if is_login:
            # Plaintext on purpose: this password is printed on the sign-in
            # page. Only /auth/demo-accounts ever reads the field, and only
            # for users carrying is_demo_login.
            doc.update({
                "is_demo_login": True,
                "demo_password": DEMO_PASSWORD,
                "demo_role_label": spec["role_label"],
                "demo_blurb": spec["blurb"],
                "demo_order": spec["order"],
            })
        user_docs.append(doc)
    await db.users.insert_many(user_docs)

    # ---- teams, memberships, invites --------------------------------------
    team_docs, membership_docs, invite_docs = [], [], []
    tid: Dict[str, str] = {}
    roster_of: Dict[str, List[str]] = {}
    for spec in TEAMS:
        team_id = did("team", spec["key"])
        tid[spec["key"]] = team_id
        team_docs.append({
            "id": team_id,
            "name": spec["name"],
            "owner_id": uid[spec["owner"]],
            "created_at": stamp(start),
            "demo": True,
        })
        members = [spec["owner"]] + list(spec["members"])
        roster_of[spec["key"]] = members
        for i, member in enumerate(members):
            membership_docs.append({
                "team_id": team_id,
                "user_id": uid[member],
                "role": "owner" if member == spec["owner"] else "member",
                "created_at": stamp(start + timedelta(days=i)),
                "demo": True,
            })
    for i, spec in enumerate(INVITES):
        invite_docs.append({
            "id": did("invite", f"{spec['team']}:{spec['email']}"),
            "team_id": tid[spec["team"]],
            "email": spec["email"].lower(),
            # Deterministic, but a demo invite grants nothing beyond a demo team.
            "token": uuid.uuid5(DEMO_NS, f"invite:{spec['team']}:{spec['email']}").hex,
            "status": "pending",
            "invited_by": uid[spec["by"]],
            "expires_at": stamp(now + timedelta(days=14 - spec["days_ago"])),
            "created_at": stamp(now - timedelta(days=spec["days_ago"])),
            "demo": True,
        })
    await db.teams.insert_many(team_docs)
    await db.memberships.insert_many(membership_docs)
    await db.invites.insert_many(invite_docs)

    # ---- growth curves ----------------------------------------------------
    species_ids = [entry["species"] for project in PROJECTS for entry in project["roster"]]
    tables, unresolved = await growth_tables(pokeapi, species_ids)
    if unresolved:
        print(
            f"WARNING: {len(unresolved)} species could not be resolved from PokéAPI "
            f"or the offline cache: {unresolved}. Partners on those species will "
            f"render without a sprite and the evolution modal may fail. Re-run the "
            f"seed once the network is back.",
            file=sys.stderr,
        )

    # ---- projects, partners, tickets, ledger ------------------------------
    book = TitleBook(rng)
    project_docs, ticket_docs, mon_docs, xp_docs = [], [], [], []

    owner_of = {t["key"]: t["owner"] for t in TEAMS}

    for project in PROJECTS:
        project_id = did("project", project["key"])
        team_key = project["team"]
        team_owner = uid[owner_of[team_key]]
        xp_per_point = project["xp_per_point"]
        project_docs.append({
            "id": project_id,
            "team_id": tid[team_key],
            "name": project["name"],
            "xp_per_point": xp_per_point,
            "synthetic_evolution_level": project["synthetic_evolution_level"],
            "evolution_level_pct": project["evolution_level_pct"],
            "created_by": team_owner,
            "created_at": stamp(start),
            "demo": True,
        })

        book.start_project(project)
        next_title = book.next
        # Backlog and In Battle are the columns anyone actually reads, so they
        # get first call on the hand-written titles even though the Done
        # tickets are generated before them. Victory can carry the composed
        # filler; nobody scrolls a Done column of fifty looking for prose.
        front = iter([
            book.next()
            for _ in range(
                sum(1 for e in project["roster"] if e.get("wip"))
                + project["in_progress"]
                + project["backlog"]
            )
        ])
        seq = 0

        def make_ticket(
            title: str,
            points: int,
            status: str,
            assignee: str | None,
            created: datetime,
            completed: datetime | None = None,
        ) -> Dict[str, Any]:
            nonlocal seq
            seq += 1
            doc = {
                "id": did("ticket", f"{project['key']}:{seq}"),
                "project_id": project_id,
                "title": title[:140],
                "description": rng.choice(DESCRIPTIONS),
                "story_points": points,
                "status": status,
                "assignee_id": uid[assignee] if assignee else None,
                "completed_by_id": uid[assignee] if (assignee and status == "done") else None,
                "completed_at": stamp(completed) if completed else None,
                # An unassigned ticket still needs an author; the team's owner
                # is the only member guaranteed to be on every project.
                "created_by": uid[assignee] if assignee else team_owner,
                "created_at": stamp(created),
                "demo": True,
            }
            ticket_docs.append(doc)
            return doc

        # Done tickets exist to pay for a level, so they are generated per
        # trainer from the growth table rather than sprinkled at random.
        for entry in project["roster"]:
            user_key = entry["user"]
            species = entry["species"]
            table = tables[species]
            banked = int(entry.get("banked", 0))
            mon_xp = xp_for(table, entry["level"], entry["frac"])
            target_xp = banked + mon_xp
            points_total = max(1, round(target_xp / xp_per_point))

            mon_id = did("mon", f"{project['key']}:{user_key}")
            mon_docs.append({
                "id": mon_id,
                "project_id": project_id,
                "user_id": uid[user_key],
                "base_species_id": species,
                "current_species_id": species,  # recomputed on first read
                "level": 1,
                "total_xp": 0,
                "stage_index": 0,
                "pending_evolution": False,
                "is_shiny": bool(entry.get("shiny")),
                "prestige": int(entry.get("prestige", 0)),
                "xp_baseline": banked,
                "created_at": stamp(start),
                "demo": True,
            })

            sizes = fib_split(points_total, rng)
            first_completed = None
            for i, points in enumerate(sizes):
                created = start + timedelta(
                    days=rng.uniform(0, HISTORY_DAYS - 4), hours=rng.uniform(0, 24)
                )
                completed = created + timedelta(
                    days=rng.uniform(0.2, 3.5), hours=rng.uniform(0, 12)
                )
                ticket = make_ticket(next_title(), points, "done", user_key, created, completed)
                first_completed = first_completed or ticket["completed_at"]
                # Exactly what the app itself would award. No fudge here — a
                # visitor who reverses this ticket gets the level back down.
                xp_docs.append({
                    "id": did("xp", f"{project['key']}:{user_key}:{i}"),
                    "player_pokemon_id": mon_id,
                    "ticket_id": ticket["id"],
                    "kind": "award",
                    "points": points,
                    "xp_awarded": points * xp_per_point,
                    "created_at": ticket["completed_at"],
                    "demo": True,
                })

            # A whole number of story points rarely lands exactly on a level
            # boundary, and at low levels one point can span several levels.
            # The residue goes in as its own ledger row rather than distorting
            # a ticket's award, so every ticket still pays points x rate.
            residue = target_xp - sum(sizes) * xp_per_point
            if residue:
                xp_docs.append({
                    "id": did("xp", f"{project['key']}:{user_key}:residue"),
                    "player_pokemon_id": mon_id,
                    "ticket_id": None,
                    "kind": "seed",
                    "points": 0,
                    "xp_awarded": int(residue),
                    "created_at": first_completed or stamp(start),
                    "demo": True,
                })

            landed = level_from_xp(mon_xp, table)
            if verbose:
                flag = " " if landed == entry["level"] else "!"
                print(
                    f"  {flag} {project['key']:<14} {user_key:<7} #{species:<4} "
                    f"L{landed:<3} {len(sizes):>3} tickets "
                    f"{points_total:>4} pts  residue {residue:+}"
                )

            # The ticket this trainer is meant to drag into Done.
            if entry.get("wip"):
                created = now - timedelta(days=rng.uniform(0.5, 4))
                make_ticket(next(front), entry["wip"], "in_progress", user_key, created)

        # Filler columns. Assignees come from the whole team, including people
        # with no partner on this project — that is a normal state.
        candidates = roster_of[team_key]
        for _ in range(project["in_progress"]):
            created = now - timedelta(days=rng.uniform(0.5, 9))
            make_ticket(
                next(front),
                rng.choices(FIB, weights=FIB_WEIGHTS, k=1)[0],
                "in_progress",
                rng.choice(candidates),
                created,
            )
        for _ in range(project["backlog"]):
            created = now - timedelta(days=rng.uniform(0, 21))
            # A third of the backlog is deliberately unassigned.
            assignee = None if rng.random() < 0.34 else rng.choice(candidates)
            make_ticket(
                next(front),
                rng.choices(FIB, weights=FIB_WEIGHTS, k=1)[0],
                "backlog",
                assignee,
                created,
            )

    await db.projects.insert_many(project_docs)
    await db.player_pokemon.insert_many(mon_docs)
    await db.tickets.insert_many(ticket_docs)
    await db.xp_events.insert_many(xp_docs)

    return {
        "users": len(user_docs),
        "teams": len(team_docs),
        "memberships": len(membership_docs),
        "invites": len(invite_docs),
        "projects": len(project_docs),
        "partners": len(mon_docs),
        "tickets": len(ticket_docs),
        "xp_events": len(xp_docs),
    }


async def main() -> int:
    parser = argparse.ArgumentParser(description="Seed PokéTrack's demo world.")
    parser.add_argument(
        "--wipe-only", action="store_true", help="Remove the demo world and stop."
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Drop the per-trainer table and the login list. The wiped/seeded "
             "summary still prints — that line is the cron log's only record "
             "that a reset happened and what it wrote.",
    )
    args = parser.parse_args()
    verbose = not args.quiet

    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        print("MONGO_URL is not set", file=sys.stderr)
        return 2

    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get("DB_NAME", "poketrack")]
    try:
        removed = await wipe(db)
        if removed:
            print("wiped: " + ", ".join(f"{k}={v}" for k, v in sorted(removed.items())))
        if args.wipe_only:
            return 0

        pokeapi = PokeApi(db)
        written = await build(db, pokeapi, verbose=verbose)
        print("seeded: " + ", ".join(f"{k}={v}" for k, v in sorted(written.items())))
        if verbose:
            print(f"\nDemo logins (password: {DEMO_PASSWORD})")
            for spec in USERS:
                if spec.get("login"):
                    print(f"  {spec['email']:<24} {spec['name']} — {spec['role_label']}")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
