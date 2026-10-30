# Responsive UX audit (2026-10-30)

An audit of every Buzzr surface on phone, tablet and desktop, written for the engineers who build the fixes. The work is scheduled as roadmap milestone **M24 — Responsive layout** (F92–F101).

## The problem in one paragraph

Buzzr was built phone-first, and it shows everywhere except the Screen. Apart from two `min-[2560px]:` classes on the Screen, the client has no responsive breakpoints. Every other page is a single phone column (`mx-auto max-w-md`, or `max-w-2xl`/`max-w-3xl` on the set pages) whatever the viewport size. On a laptop the Host-a-game picker is a 448px card with a 320px scroll box, floating in an empty page, and it truncates set titles. The Host remote is a 448px strip whose tabs hide each other. The Player header and Who's-here bar sit at the far edges of a 1440px window while the buzzer sits alone in the middle. The Screen is well tuned for 16:9, but text has no lower bound on 4:3, portrait and phone-sized displays, and the host bar wraps over content at 720p.

Phones work today. Nothing in M24 may make the phone layouts worse.

## How the audit was done

- Read all 40 client pages and components, with file:line evidence for each finding. Line numbers are from commit `92cb0a6` and will drift; search for the quoted class if a line has moved.
- Ran the app (`npm run dev`) in Chrome. Looked at Landing, the host picker, RoomCreated, `/sets`, the set editor, and the Screen lobby, question and buzzed states. Also looked at the Player join, lobby and buzzed states, and the Host remote. Window sizes were 1440×900, 1024×768 and phone width.

## Documents

| File | Covers | Issue prefix |
|---|---|---|
| [00-foundations.md](00-foundations.md) | Breakpoints, page shell, shared classes, type and target floors, copy, scrolling rules. **Read first.** | `FND` |
| [01-landing-and-hosting.md](01-landing-and-hosting.md) | Landing, Host-a-game picker, RoomCreated, NewGamePicker, GameBuilder | `LND` |
| [02-set-library.md](02-set-library.md) | `/sets`, SetBrowser, SetPreview, AnswerSheet | `LIB` |
| [03-set-editor.md](03-set-editor.md) | `/sets/:setId`, QuestionCard, PasteQuestions, QuestionPreview | `EDT` |
| [04-player.md](04-player.md) | `/play/:code`, every buzzer state | `PLY` |
| [05-host-remote.md](05-host-remote.md) | `/host/:code`, Game, Players and Settings tabs | `HST` |
| [06-screen.md](06-screen.md) | `/screen/:code`, every phase, host bar and overlays | `SCR` |

Each issue has:
- an ID, such as `PLY-04`
- a severity
- the viewports it affects
- evidence, as file:line from `client/src/`
- a recommendation
- acceptance criteria ("Done when")

## Severity

| Level | Meaning |
|---|---|
| **P1** | Broken or blocks use: content clipped with no way to reach it, unreadable text, a control covering content. |
| **P2** | Looks wrong or slows people down: wasted space, squeezed lists, wrong emphasis, hidden actions. |
| **P3** | Polish: hover states, copy, small inconsistencies. |

## Device matrix

Every M24 feature is checked at these viewports with `/playtest` screenshots:

| Viewport | Stands for | Surfaces that matter most |
|---|---|---|
| 375×667 | Small phone, portrait | Player, Host remote, Landing |
| 667×375 | Phone, landscape | Player, Host remote |
| 820×1180 | Tablet, portrait | Host remote, set pages, Screen (fallback) |
| 1024×768 | Tablet landscape, small laptop | Everything; the Screen at 4:3 |
| 1440×900 | Laptop | Landing, set pages, editor, Host remote, Screen |
| 1920×1080 | TV | Screen (the main target) |

## Roadmap mapping

| Feature | Issues it closes |
|---|---|
| F92 Responsive foundations | FND-01 … FND-08 |
| F93 Landing and host picker on every screen | LND-01 … LND-08 |
| F94 Set library grid | LIB-01 … LIB-08 |
| F95 Set editor toolbar and outline | EDT-01 … EDT-10 |
| F96 Player phone: landscape and short screens | PLY-01 … PLY-06 |
| F97 Player on tablet and desktop | PLY-07 … PLY-11 |
| F98 Host remote on the phone | HST-01 … HST-08 |
| F99 Host remote dashboard on tablet and desktop | HST-09 … HST-11 |
| F100 Screen legibility on any display | SCR-01 … SCR-08 |
| F101 Screen host bar and overlays | SCR-09 … SCR-16 |

## Possible spec tensions

These are not spec changes. Record each one in `docs/DECISIONS.md` when you meet it. Never edit `docs/SPEC.md`.

- **Player, "the whole viewport is one circular button".** On tablet and desktop the buzzer sits in a centred shell (PLY-07). The intent still holds, because Space and a press anywhere on the stage can buzz, but say so in DECISIONS.
- **Set editor, "Questions in a vertical list, each a card".** The outline sidebar (EDT-02) is navigation only. The cards stay one vertical list.
- **Host remote, "Phone-first layout".** The tablet and desktop dashboard (HST-09) is an enhancement. The phone layout stays the baseline and is designed first.
- **Screen, "Designed for 1920×1080".** Nothing in `06-screen.md` may change how 1920×1080 looks, except for fixes to defects that show there too (SCR-09, SCR-11).
