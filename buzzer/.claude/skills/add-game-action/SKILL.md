---
name: add-game-action
description: Checklist for adding or changing a game action or socket event end to end. Use whenever work adds or changes a client→server event, a reducer action, or a server→client payload.
---

# Add or change a game action

Work through these in order and tick each off in your plan. Skip a step only when it doesn't apply, and say so.

1. **Types:** add or adjust the payload and action types in `shared/types.ts`. Server→client payload changes go in the view or `fx` types.
2. **Schema:** add a zod schema in `shared/schemas.ts` with the spec's limits. Infer or check the type against step 1.
3. **Reducer:** add the case in `server/reducer.ts` with its phase guard. Reject every phase not listed in the spec's transitions table. Keep it pure: time comes in as `now`, timers go out as effects carrying `questionIndex` and `openingCounter`.
4. **Reducer tests:** cover the happy path, the resulting effects, invalid-phase rejection, and stale scheduled effects where relevant.
5. **Socket handler** in `server/sockets.ts`:
   - Auth check: hostToken for `host:*`, own `playerId` for `player:*`.
   - zod parse.
   - Rate limit.
   - Call `reduce`.
   - Ack `{ok: true}` or `{ok: false, error}`.
   - Broadcast fresh views.
6. **Views:** update `toView()` in `server/views.ts` if the action adds state. Extend the leak test so any new secret field is checked in Screen and Player views.
7. **Client:** wire the store and UI. The client sends the event and renders the next snapshot. It never predicts the result. Show a toast on a failed ack.
8. **Docs:** if `CLAUDE.md` lists events, update that table. If the spec was silent on anything, log it in `docs/DECISIONS.md`.
