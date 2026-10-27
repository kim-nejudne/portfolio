---
paths: ["client/**"]
---

# Client conventions

- Render from the Zustand snapshot store only. Never derive game rules (phases, eligibility, scoring) on the client. Read them from the view.
- The buzzer fires on `pointerdown` (and Space on desktop), never `click`. Show local pressed feedback before the ack arrives.
- Player colours come from `shared/constants`. Never hard-code a colour per player.
- The Screen view targets 1920×1080, uses viewport units (`vw`/`vh`/`clamp`), and must be legible from 5 m.
- Player and Host layouts are mobile-first. Check them at 375 px wide.
- Never put answer text or host notes into any Screen component before reveal, not even hidden, in a `title`, or in a `data-` attribute.
- Never use `dangerouslySetInnerHTML`.
- The socket uses the WebSocket transport only (`transports: ['websocket']`).
