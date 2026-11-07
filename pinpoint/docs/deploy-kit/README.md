# Deploy kit

Rendered by the bootstrap for F60 and F59. These are starting points, not live files:

| File | Moves to | Feature |
| --- | --- | --- |
| `Dockerfile.node` | `Dockerfile` | F59 |
| `docker-smoke.sh` | `scripts/docker-smoke.sh` | F59 |
| `deploy.yml` | `../.github/workflows/deploy-pinpoint.yml` (the monorepo's root, not this app's folder) | F60 |
| `ci-jobs.yml` | its two jobs into `../.github/workflows/ci.yml` (nothing else in that file changes) | F01 |

F60 also adds Pinpoint to the root `../README.md` in the same shape as the other apps (their table row and provenance line).

Keep in `deploy.yml`: the job names `checks` and `droplet`, the step name `build and smoke-test the image`, the check step names, and the line `ABORT: N live connection(s) after 10 min`. `scripts/autopilot.sh` matches them to tell a code failure (repair session) from an infrastructure one (one re-run) and to force a deploy past live connections.

Already live, do not change: `deploy/nginx/pinpoint.conf` (installed on the droplet in prep; nginx is root's), `deploy/compose.deploy.yaml` (shipped by the workflow; the smoke test reads its port and `mem_limit`).

GitHub secrets: the monorepo's shared deploy secrets (SSH_HOST SSH_USER SSH_KEY SSH_KNOWN_HOSTS, environment `production`), which the other apps' deploy workflows use too. Never change them. App secrets live only in `/opt/pinpoint/.env` on the droplet; the container reads them through `env_file`.

F60 deletes this folder once the files are in place.
