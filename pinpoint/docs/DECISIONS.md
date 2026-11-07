# Decisions

Only Kim edits `docs/spec.md`. Gaps and conflicts found while building go here, newest last. Code that relies on a row cites it (`// SPEC-QUESTION: DECISIONS 12`); add the row before citing it.

## Open spec questions

Mirrored from the spec's open questions. Until Kim says otherwise, a feature that hits one uses the recommendation and records it under "Decisions made".

None open: the spec's four questions were settled at the spec review on 2026-11-07 (spec "Resolved questions", `docs/spec-review.md`).

## Decisions made

| # | Date | Feature | Decision | Why |
| --- | --- | --- | --- | --- |
| 1 | 2026-11-07 | bootstrap | Live at `pinpoint.kimnejudne.dev` on Kim's droplet, host port `127.0.0.1:3007` (checked free with `ss -ltn`), stack dir `/opt/pinpoint` (root:deploy, 1775) with its `.env`; nginx vhost and certbot certificate installed in prep; the vhost is `deploy/nginx/pinpoint.conf` | Root steps can't run unattended; the deploy uses only the `deploy` user |
| 2 | 2026-11-07 | bootstrap | Unattended runs queue person-only checks under "Kim checks" in PROGRESS.md and mark the feature done; anything that must not ship without Kim's approval carries a `Gate:` line in the roadmap instead | A start-to-finish run must not block on a person, but approvals are not checks |
| 3 | 2026-11-07 | bootstrap | Real keys exist only in `/opt/pinpoint/.env` and GitHub secrets. Code reads env vars; tests and development use fakes | Build sessions never see real keys |
| 4 | 2026-11-07 | bootstrap | The container's data directory is `/data` (compose sets `DATA_DIR=/data` and mounts `/opt/pinpoint/data:/data`), not the spec's `/app/data`. The image still defaults `DATA_DIR` to `/app/data` when run without the compose file; the Dockerfile creates both owned by uid 1000 | The bootstrap's compose template mounts every app's data at `/data`; the env var makes the path a deploy detail with no behaviour change |
| 5 | 2026-11-07 | bootstrap | In development the server listens on `PORT=3010` and Vite on `5180` (the dev script sets them; the container default stays 3000) | Buzzr and Sketchy use 3000 and 5173, the hub 4500/4501; Kim may run them at the same time, and the autopilot kills strays on these ports |
| 6 | 2026-11-07 | bootstrap | `/opt/pinpoint/.env` starts with `PINPOINT_CARTO_KEY` and `WIKIMEDIA_CONTACT` empty: the live app serves the fallback tiles and generation is off until Kim sets them (F60 Kim check). The live smoke runs without `SMOKE_EXPECT_TILES` until then | Kim has the Anthropic key now; the CARTO account and contact come later |

## Proposed spec changes
