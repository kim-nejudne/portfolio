# Sketchy

A party drawing game for barkada nights. One **Screen** (a laptop on a TV, a tablet or a spare phone) shows the live drawing. The **drawer** draws a secret word on their phone, and everyone else types guesses on theirs. Faster correct guesses score more, corrected for each phone's network latency.

One Node process runs Express and Socket.IO (the main namespace and `/ink`, for the drawing) and serves the built React client. Rooms live in memory. There are no accounts, no database, no paid services and no analytics. The spec is `docs/spec.md`, and every decision it left open is in `docs/DECISIONS.md`.

## Develop

Node 24 or newer and npm.

```sh
npm ci
npm run dev          # server :3000 + Vite :5173 on 0.0.0.0
```

Open `http://localhost:5173` for the Screen. Phones on the same Wi-Fi join with `npm run lan [CODE]`, which prints the LAN Screen and join URLs with terminal QR codes. `/dev/bots/CODE` (development only) spawns fake players.

| Command                      | What it does                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm test`                   | Vitest, once                                                                                          |
| `npm run typecheck`          | TypeScript, client and server                                                                         |
| `npm run lint`               | ESLint                                                                                                |
| `npm run format:check`       | Prettier check (`npm run format` writes)                                                              |
| `npm run build`              | Client to `dist/client`, server to `dist/server` and `dist/shared`                                    |
| `npm start`                  | Runs the build in production mode on `PORT` (default 3000)                                            |
| `npm run playtest -- <file>` | Playwright harness, one isolated browser context per role                                             |
| `npm run packs:check`        | Validates the word packs in `data/packs/`                                                             |
| `npm run size`               | Builds and measures the join budget (`/` + `/play` ≤ 120 KB JS, ≤ 30 KB CSS and font)                 |
| `npm run smoke -- <URL>`     | Smoke checks against any running server: `/healthz`, the client, a room, both Socket.IO namespaces    |
| `npm run smoke:docker`       | Builds the image, runs it with the droplet's settings and runs the smoke checks against it            |
| `npm run mem:probe`          | Needs `npm run build`. Peak memory of a 10-player game with a full gallery (`-- --games N --heap MB`) |

`scripts/autopilot.sh` builds the remaining roadmap features unattended, one fresh Claude Code session each. When nothing is left, it runs the checks, pushes `main` and watches the deploy.

## Docker

The `Dockerfile` has four stages on `node:24-slim`: it installs, builds, installs the runtime dependencies alone, then copies `dist/`, those dependencies and the word packs (`data/packs`) into the runtime image. That image runs as the unprivileged `node` user and has a `HEALTHCHECK` on `/healthz`. Nothing is written at run time, so there is no volume.

```sh
docker build -t sketchy .
docker run --rm -p 3000:3000 sketchy
curl -i http://localhost:3000/healthz     # 200 {"ok":true}
```

### Environment

| Variable       | Default                     | Meaning                                                                                                                                                                                                                                                                                     |
| -------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`         | `3000`                      | Port the server listens on inside the container                                                                                                                                                                                                                                             |
| `NODE_ENV`     | `production` (in the image) | Serves the built client. `development` turns on `/dev/bots` and the dev-only word route, so never set it on the droplet                                                                                                                                                                     |
| `TRUST_PROXY`  | off                         | **Set this behind a reverse proxy.** A hop count such as `1`, `true`, or an Express trust string. Unset, every phone behind the proxy shares one address in the rate limits (10 joins a minute, 10 new games an hour). Never set it without a proxy: then anyone can fake `X-Forwarded-For` |
| `NODE_OPTIONS` | unset                       | The droplet sets `--max-old-space-size=128`, so V8 collects well before the container's 256 MiB limit                                                                                                                                                                                       |

## Deploy

Sketchy runs on Kim's DigitalOcean droplet at **https://sketchy.kimnejudne.dev**, beside Buzzr and the other apps, and shares nothing with them: its own container, port, stack directory, environment and vhost.

|         |                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Image   | `sketchy:<tag>`, built on the runner (or a workstation) and shipped with `docker save \| ssh docker load`. The droplet builds nothing                                          |
| Process | one container, Node on **loopback `127.0.0.1:3006`**, from `deploy/compose.deploy.yaml` (Buzzr has 3005, PokéTrack 3004)                                                       |
| Stack   | `/opt/sketchy/compose.yaml` and `/opt/sketchy/.env` (mode 600: `IMAGE_TAG=` only), both owned by `deploy`; `/opt/sketchy` is `root:deploy` with the sticky bit                 |
| Env     | `TRUST_PROXY=1` and `NODE_OPTIONS=--max-old-space-size=128`, set in the compose file. No secrets                                                                               |
| nginx   | `/etc/nginx/sites-available/sketchy`, from `deploy/nginx/sketchy.conf`. Proxies everything, with the WebSocket upgrade on `/socket.io/` (both namespaces share it)             |
| TLS     | certbot, webroot method against `/var/www/certbot`                                                                                                                             |
| Memory  | `mem_limit: 256m`. One 10-player game with a full gallery peaks at about 166 MB; two at once are the ceiling (DECISIONS 73). The box has about 700 MB free beside Buzzr's 384m |

The droplet's root setup (the directory, `.env`, the vhost and the certificate) was done in the bootstrap on 2026-10-30. `deploy/nginx/sketchy.conf` and `deploy/nginx/sketchy-bootstrap.conf` are the live files; keep them in step with the box.

Two placeholders run through these steps, and neither is recorded in this repository. `$DEPLOY_HOST` is the droplet as `user@host` (the `deploy` user, never root, except where a step says so), for ssh and scp. `$DROPLET_IP` is its IPv4 address, for DNS. Run every command from `sketchy/`.

> **A deploy ends every live game.** Rooms live in memory, so a restart drops them, and every connected device shows "This game has ended". Deploy when no game is running. The push-to-deploy workflow waits for this (below).

**A push to `main` that touches `sketchy/` deploys it.** Markdown, `docs/` and `.claude/` changes don't count. The workflow is `.github/workflows/deploy-sketchy.yml` in the portfolio:

1. `checks`: typecheck, lint, format check and tests run on the runner.
2. `droplet`: `scripts/docker-smoke.sh sketchy:<tag>` builds the image and smoke-tests it there, with `TRUST_PROXY`, `NODE_OPTIONS`, `mem_limit` and the port read from the compose file. The tag is the last commit that changed shipped code under `sketchy/`, not the repository HEAD.
3. The image is shipped with `docker save | ssh docker load`, and `deploy/compose.deploy.yaml` is copied to `/opt/sketchy/compose.yaml`.
4. On the box, as `deploy`, it counts established connections to `127.0.0.1:3006`. nginx keeps no upstream keepalive, so each one is a live WebSocket from a Screen or a phone. It waits up to 10 minutes for the count to reach zero, and fails without changing anything if it doesn't (`ABORT: N live connection(s) after 10 min`).
5. It re-points `IMAGE_TAG`, restarts, and waits for `/healthz`. If that never answers, it rolls `IMAGE_TAG` back to the previous tag. The previous image stays on the box.
6. It runs `npm run smoke -- https://sketchy.kimnejudne.dev` from outside, through nginx and TLS: `/healthz`, the client and its entry script, the `/play` fallback, a room (swept after 3 h idle), the dev word route closed, and WebSockets on `/` and `/ink`.

A Screen left open on a TV keeps its socket, so the wait can fail with no game running. In that case:

```sh
gh workflow run deploy-sketchy.yml -f force=true   # ends any live games
```

The steps below are the same release done by hand: the break-glass path for when Actions is what's broken.

### Routine deploy (break-glass)

Build from a clean, committed tree, smoke-test the image, ship it, re-point and restart:

```sh
TAG=$(git log -1 --format=%h -- .)
npm ci && npm run smoke:docker -- sketchy:$TAG       # builds sketchy:$TAG and checks it
docker save sketchy:$TAG | gzip -1 | ssh $DEPLOY_HOST 'gunzip | docker load'
ssh $DEPLOY_HOST "ss -Htn state established '( sport = :3006 )' | wc -l"   # 0 = no live games
ssh $DEPLOY_HOST "sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/' /opt/sketchy/.env \
  && cd /opt/sketchy && docker compose up -d"
ssh $DEPLOY_HOST 'curl -fsS http://127.0.0.1:3006/healthz'          # {"ok":true}
npm run smoke -- https://sketchy.kimnejudne.dev
```

When `deploy/compose.deploy.yaml` changes, copy it first:

```sh
scp deploy/compose.deploy.yaml $DEPLOY_HOST:/opt/sketchy/compose.yaml
```

When `deploy/nginx/sketchy.conf` changes, a person with root moves it. `nginx -t` is the guard: if it fails, nothing reloads and the other sites keep running.

```sh
scp deploy/nginx/sketchy.conf root@<droplet>:/etc/nginx/sites-available/sketchy
ssh root@<droplet> 'nginx -t && systemctl reload nginx'
```

### Rolling back

Earlier images stay on the box. The push-button way re-points `IMAGE_TAG` through the same live-game wait and health gate, with no build:

```sh
ssh $DEPLOY_HOST 'docker images sketchy'                     # known tags
gh workflow run deploy-sketchy.yml -f tag=<good-tag>
```

Or by hand:

```sh
ssh $DEPLOY_HOST "sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<good-tag>/' /opt/sketchy/.env \
  && cd /opt/sketchy && docker compose up -d"
```

Prune old tags now and then with `docker image rm sketchy:<old-tag>`. The disk is shared.

### Rebuilding the box's setup

Needed only if the droplet is rebuilt; the bootstrap did this once. As root:

1. **DNS.** At Namecheap, Advanced DNS: an `A` record, host `sketchy`, value `$DROPLET_IP` (in place since 2026-10-30). Check `dig +short @pdns1.registrar-servers.com sketchy.kimnejudne.dev A`.
2. **Directory.** `install -d -o root -g deploy -m 1775 /opt/sketchy`, then as `deploy`: `printf 'IMAGE_TAG=\n' > /opt/sketchy/.env && chmod 600 /opt/sketchy/.env`, and copy the compose file as above.
3. **Bootstrap vhost.** `sketchy.conf` names the certificate files, so `nginx -t` fails until they exist. Install `deploy/nginx/sketchy-bootstrap.conf` as `/etc/nginx/sites-available/sketchy`, link it into `sites-enabled`, then `nginx -t && systemctl reload nginx`. Check `http://sketchy.kimnejudne.dev/.well-known/acme-challenge/<token>` serves a test file from `/var/www/certbot` first: a failed validation counts against Let's Encrypt's rate limit.
4. **Certificate.** `certbot certonly --webroot -w /var/www/certbot -d sketchy.kimnejudne.dev`. certbot's timer renews it; the port-80 block of `sketchy.conf` keeps the webroot reachable.
5. **The real vhost.** Install `deploy/nginx/sketchy.conf` over the bootstrap one, `nginx -t && systemctl reload nginx`. Never leave the bootstrap vhost installed.
6. **Ship an image** with the routine deploy above.

The vhost does what Sketchy needs: `Upgrade` and `Connection` on `/socket.io/` (without them every device falls back to long-polling, which adds latency to guesses and ink), a 120 s read timeout (Socket.IO pings every 5 s), no upstream keepalive (the deploy's live-game count relies on it), `client_max_body_size 256k`, and gzip level 6, which keeps the player page inside the 120 KB join budget.

### Health checks

```sh
curl -s https://sketchy.kimnejudne.dev/healthz                    # {"ok":true}
curl -sI https://sketchy.kimnejudne.dev/ | head -1                 # HTTP/2 200
npm run smoke -- https://sketchy.kimnejudne.dev                    # PASS
ssh $DEPLOY_HOST 'docker ps --filter name=sketchy'                 # Up (healthy)
ssh $DEPLOY_HOST 'docker stats --no-stream sketchy-app-1'          # memory against the 256 MiB limit
ssh $DEPLOY_HOST 'tail -n 20 /var/log/nginx/sketchy.access.log'    # /socket.io/ lines answer 101
```

Then play the Manual playtest checklist in `docs/spec.md` on real devices against the deployed URL, with at least two phones on mobile data.
