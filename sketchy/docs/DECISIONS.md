# Decisions

Only Kim edits `docs/spec.md`. Gaps and conflicts found while building go here, newest last.

## Open spec questions

Mirrored from the spec's "Open questions". Until Kim says otherwise, a feature that hits one uses the recommendation and records it under "Decisions made".

1. **Drawer's share.** 50% of the guessers' total. *Recommend:* keep 50% until the first playtests.
2. **Lists to review.** The Tagalog profanity and slur lists, blocked room-code words, Taglish copy, glosses and the spicy pack. *Recommend:* build them, then queue them under "Kim checks" in PROGRESS.md.
3. **Non-playing host remote.** *Recommend:* not in v1; Backlog if a group asks.
4. **Difficulty calibration.** *Recommend:* no per-word logging in v1.

## Decisions made

| # | Date | Feature | Decision | Why |
| --- | --- | --- | --- | --- |
| 1 | 2026-10-30 | bootstrap | Host port `127.0.0.1:3006` on the droplet (checked free with `ss -ltn`) | PokéTrack has 3004, Buzzr 3005 |
| 2 | 2026-10-30 | bootstrap | Droplet root setup done ahead of F52: `/opt/sketchy` (root:deploy, 1775), `.env` (`IMAGE_TAG=`), nginx vhost and certbot cert for `sketchy.kimnejudne.dev`; the live vhost is at `deploy/nginx/sketchy.conf` | Root steps can't run unattended; the deploy only uses the `deploy` user |
| 3 | 2026-10-30 | bootstrap | Unattended runs queue human-only checks (real phones, mobile data, Kim's reviews) under "Kim checks" in PROGRESS.md and mark the feature done | Kim asked for a start-to-finish run with no blocking |
| 4 | 2026-10-30 | F01 | `npm run lan` prints the landing page `/` as the Screen URL (a Screen is created there with "Start a game on this screen") and `/play/CODE` for a code; `--port 3000` targets `npm start`. `lanAddress` lives in `server/lan.ts` (ported from Buzzr's `env.ts`) so the server's join QR can reuse it later | The Screen URL needs a code that only exists after Start |
| 5 | 2026-10-30 | F01 | Playtest harness is a plain `playwright` script (`scripts/playtest/harness.ts`, `run.ts`), not `@playwright/test`; all roles run in Chromium with device emulation (Pixel 7, iPhone 13, 360×560, tablet, 1920×1080 TV); falls back to `/usr/bin/chromium` when Playwright's browser isn't downloaded. New dev deps: `playwright` (the harness F01 requires), `qrcode` (terminal QR for `npm run lan`; `qrcode.react` can't print to a terminal) | Scenarios are scripts the playtester agent writes and runs one at a time; no test runner needed |
