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
