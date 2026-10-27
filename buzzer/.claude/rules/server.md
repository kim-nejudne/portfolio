---
paths: ["server/**", "shared/**"]
---

# Server and shared conventions

- The reducer is pure. It does no I/O and uses no timers, `Date.now()`, `performance.now()` or `Math.random()`. Time is passed in as `now`. Randomness (codes, tokens) happens in the gateway or HTTP layer.
- Effects are returned, not performed. The gateway runs them. Scheduled effects carry `questionIndex` and `openingCounter`, and the reducer ignores stale ones.
- Buzz times come from a monotonic server clock (`performance.now()`), never `Date.now()`.
- Views are built only through `toView(room, role, playerId?)` in `server/views.ts`. Never emit `room` or any part of it directly.
- Apply the spec's limits: `player:buzz` 5/s per socket, `player:join` per IP (see DECISIONS #3), room creation 10/h per IP, 50 players, names 1–16 trimmed, 100 KB socket messages, 1.5 MB per image, 50 MB per room.
- Every handler validates its payload with the zod schema from `shared/schemas.ts` and acks `{ok: true}` or `{ok: false, error}`.
- All score changes go through `applyJudgement()`. All room storage goes through the `RoomStore` interface.
- Use the `add-game-action` skill whenever an event or action is added or changed.
